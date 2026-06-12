# Phase 6 — Bounded one-agent coding runtime (DESIGN ONLY, DO NOT IMPLEMENT)

**Scope:** MVP 2.2 — the smallest safe single-agent coding runtime that operates ONLY inside an
isolated task workspace and emits engineering events into the existing a2a event log so Mission
View shows real work. **Feature-flagged OFF by default.** Conditional on Gate 6 (dual-Opus PASS).
This document is the design + a "smallest-first PR" surface for Phase 7. It changes **no application code**.

Authority: `.workflow/mission-view-bounded-runtime/contract.md` (MVP 2.2 + command-allowlist strategy).
Companion: `risk-register.md` (risk · severity · mitigation · residual · gate).

---

## 0. What already exists (do NOT rebuild)

The event plumbing is **already done** in MVP 2.0/2.1. Verified against the tree:

- `A2aEventType` union already contains all 7 engineering types — `server/src/db/repositories/a2aRepository.ts:343-357` (`agent_status`, `pipeline_stage`, `file_edit`, `command_run`, `test_result`, `review_comment`, `vcs_event`).
- `appendEvent(...)` already accepts those types and fires `pg_notify` for SSE — `a2aRepository.ts:369-396`.
- Zod schemas + `parseEngineeringEvent` + `isEngineeringEventType` already exist — `server/src/a2a/engineeringEvents.ts:104-134`.
- The mapper already forwards engineering events to REST/SSE (no longer dropped at `default`) — `server/src/a2a/mapper.ts:92-96`.

**Implication for Phase 7:** the runtime's only event responsibility is to **call `appendEvent` with a
payload that passes `parseEngineeringEvent`**. No migration, no mapper change, no schema change.
The contract's "one migration `0017`" belongs to MVP 2.0 and is already landed/owned there — 2.2 adds none.

What is genuinely **NEW** (none of this exists in `server/src` today — confirmed by grep: no
`child_process`, `spawn`, `execFile`, `git worktree`, `realpath`, `mkdtemp` anywhere):

1. Workspace provisioning/teardown (git worktree under a temp root).
2. A path jail (realpath-resolved, reject-on-escape).
3. An argv-array command runner (allowlist + timeout + output cap + scrubbed env).
4. A tool layer for the model (`read_file` / `write_file` / `run_command`) — `liveRuntime` is text-only today.
5. A bounded agent loop that drives tool calls and maps each to an engineering event.
6. An extension of the `ModelProvider` seam to carry tool-use (the current provider only reads `type === 'text'` blocks — `server/src/agents/providers/anthropicProvider.ts:63-67`).

---

## 1. Runtime placement (no change to default behavior)

### Decision: a third `AgentRuntimeMode` value `coding`, gated by a SEPARATE boolean flag

`AgentRuntimeMode` today is `'mock' | 'live'` (`server/src/agents/runtime.ts:34`, `server/src/config.ts:8`).
`getAgentRuntime` switches on `config.agentRuntimeMode` (`server/src/agents/registry.ts:18-26`).

We add a **conjunction**, not a replacement:

- New env flag **`MISSION_RUNTIME_ENABLED`** (default `false`), parsed by the existing `parseBoolean`
  helper (`config.ts:112-118`) into `config.missionRuntimeEnabled: boolean`.
- The coding runtime is selected **only** when BOTH hold: `agentRuntimeMode === 'live'` AND
  `missionRuntimeEnabled === true` AND the task is flagged as a "mission/coding" task (see §1.2).
- Default config (`mock`, flag absent) is byte-for-byte unchanged. A plain `live` deployment without
  the flag is also unchanged — it keeps getting the text-only `createLiveRuntime`.

```
// registry.ts — getAgentRuntime, new branch placed BEFORE the existing live branch,
// but only taken for a coding-eligible task. Pseudocode:
export function getAgentRuntime(role, config = readConfig(), opts?: { coding?: boolean }): AgentRuntime {
  if (opts?.coding && config.agentRuntimeMode === 'live' && config.missionRuntimeEnabled) {
    return createCodingRuntime(role, getModelProvider(config), {
      maxIterations: config.missionMaxIterations,
      wallClockMs: config.missionWallClockMs,
      maxTokens: config.agentLiveMaxTokens,
      perCommandTimeoutMs: config.missionCommandTimeoutMs,
      maxOutputBytes: config.missionMaxOutputBytes,
      repoRoot: config.missionRepoRoot   // the checkout to worktree from
    })
  }
  if (config.agentRuntimeMode === 'live') return createLiveRuntime(role, getModelProvider(config), {...})
  return getMockRuntime(role)
}
```

**Config additions** (`config.ts` — mirror the existing `agentLive*` knobs at `config.ts:64-65`, all with safe defaults):
- `missionRuntimeEnabled: boolean` ← `MISSION_RUNTIME_ENABLED` (default **false**).
- `missionMaxIterations: number` ← default **12**.
- `missionWallClockMs: number` ← default **300_000** (5 min hard ceiling for the whole run).
- `missionCommandTimeoutMs: number` ← default **120_000** (per the contract).
- `missionMaxOutputBytes: number` ← default **65_536** (64 KiB tail, per the contract).
- `missionRepoRoot: string | null` ← absolute path of the repo checkout to base worktrees on; default `process.cwd()`. **Must be validated at boot** (see §9 boot assertion).
- An `assertMissionRuntimeConfig(...)` called from `readConfig` that **hard-fails boot** if `MISSION_RUNTIME_ENABLED=true` but `AGENT_RUNTIME_MODE!=live`, or `git` is not on PATH, or `missionRepoRoot` is not a git repo. Fail-closed, mirroring `assertAgentRuntimeConfig` (`config.ts:124-132`).

### 1.2 Which tasks are "coding" tasks

The worker (`server/src/workers/agentTaskWorker.ts:129`) currently calls `getAgentRuntime(agent.role)`
unconditionally. We need a **deliberate, narrow** trigger so normal chat/doc agents never enter the
coding runtime. Smallest safe option:

- A coding task is one created with an explicit marker on the originating message metadata
  (e.g. `metadata.mission === true`) OR bound to a dedicated "mission" agent role. The worker reads
  this and passes `{ coding: true }` to `getAgentRuntime`.
- **Recommendation:** add a single dedicated role/agent ("mission-coder") rather than overloading
  planner/reviewer, so the blast radius is one agent and existing roles are provably untouched.
- If the flag is off OR the task is not marked, the worker behaves exactly as today.

### 1.3 Emitter integration — reuse, do not fork

`AgentEmitter` (`runtime.ts:4-13`) has `status/artifact/message/appendDocument` only. The worker builds
the concrete emitter at `agentTaskWorker.ts:56-112`, closing over `taskId` + `task.context_id`.

Add ONE method to `AgentEmitter`:

```
/** Append a validated engineering event to the task event log (Mission View work surface). */
engineering(event: EngineeringEvent): Promise<void>
```

Worker implementation (new arm in the `emit` object, `agentTaskWorker.ts`):

```
engineering: async (event) => {
  const parsed = parseEngineeringEvent(event)        // engineeringEvents.ts:131
  if (!parsed) { deps.logger.warn('dropped invalid engineering event', { taskId }); return }
  await appendEvent({
    taskId, contextId: task.context_id,
    eventType: parsed.kind,                            // kind === event_type by contract
    payload: parsed as unknown as Record<string, unknown>,
    visibleToUser: true
  })
  await enqueuePushForTask(taskId).catch(() => undefined)
}
```

This reuses `appendEvent` (the SSE/notify path) verbatim — **no parallel realtime infra**, satisfying the
contract's core principle. The mock runtime can also adopt `emit.engineering(...)` to seed the demo with
real events (`demo:true`), which is the same path the live runtime uses minus the `demo` flag.

---

## 2. Isolated task workspace (git worktree, realpath-jailed)

### Provisioning: `git worktree add` from `missionRepoRoot`

```
const base = await fs.realpath(missionRepoRoot)                  // resolve symlinks once
const jailParent = await fs.mkdtemp(path.join(os.tmpdir(), 'syncspace-mission-'))
const jail = path.join(jailParent, 'ws')
const branch = `mission/${taskId}`                                // throwaway, never pushed
// argv-array, never a shell string:
await runGit(base, ['worktree', 'add', '--detach', jail, 'HEAD'])
const jailReal = await fs.realpath(jail)                          // canonical jail root for all checks
```

Rationale for **worktree over fresh-temp-dir-with-seeded-files**:
- A worktree gives the agent the *real* repo state to reason about and lets `git -C <jail> diff` produce
  a meaningful final artifact (§6) against `HEAD` for free.
- `--detach` means commits (if the agent ever makes any — it won't in 2.2) never move a branch the main
  checkout cares about.
- The worktree shares the object store with `missionRepoRoot` but has its **own working tree and index**,
  so working-tree writes do NOT touch the main checkout's files. The shared `.git/worktrees/<id>` admin
  dir is the one coupling point — see the threat note in §8 (W-1) and the `core.hooksPath` neutralization.

**Hardening at creation:**
- Disable hooks in the child git env: pass `-c core.hooksPath=/dev/null` on every `runGit` call so a
  repo-committed `post-checkout`/`pre-commit` hook can't execute during `worktree add`/`diff`.
- The worktree is created under `os.tmpdir()`, never under `missionRepoRoot`, so a jail-escape write
  still cannot land inside the source tree by relative climbing alone (it would land in the OS temp area).

### Teardown (always, even on failure)

```
try { ...run... } finally {
  await runGit(base, ['worktree', 'remove', '--force', jailReal]).catch(()=>{})
  await runGit(base, ['worktree', 'prune']).catch(()=>{})
  await fs.rm(jailParent, { recursive: true, force: true }).catch(()=>{})
}
```

Teardown lives in a `finally` that wraps the whole run, so a thrown error, a timeout abort, or a process
signal still removes the worktree registration and deletes the temp tree. A `worktree prune` sweeps any
orphan registration from a hard crash on the next run. (Optional belt-and-suspenders: a startup sweep that
prunes `mission/*` worktrees older than N hours.)

### The jail invariant (the security spine of this design)

A single resolver gates **every** file path the agent supplies. It mirrors the rigor of `safeHttp.ts`
(resolve-then-validate, refuse-on-violation):

```
async function resolveInsideJail(jailReal: string, userPath: string): Promise<string> {
  // 1. Reject absolute paths and NUL bytes outright.
  if (path.isAbsolute(userPath) || userPath.includes('\0')) throw new JailError('absolute_or_nul')
  // 2. Resolve against the jail, then realpath to collapse symlinks + '..'.
  const candidate = path.resolve(jailReal, userPath)
  const real = await fs.realpath(candidate).catch(async (e) => {
    if (e.code === 'ENOENT') return resolveParentRealpath(jailReal, candidate) // for writes to new files
    throw e
  })
  // 3. The canonical path MUST be jailReal or a descendant. Use a path-segment check, not startsWith.
  const rel = path.relative(jailReal, real)
  if (rel === '' ) return real
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new JailError('escapes_jail')
  return real
}
```

Notes that make this actually safe (each is a tested requirement at Gate 7):
- **realpath resolves symlinks** — an agent that creates `link -> /etc` inside the jail then writes
  `link/passwd` is caught because the resolved target escapes `jailReal`. (`safeHttp.ts` pins post-resolution
  for the same TOCTOU reason; we adopt the identical discipline for the filesystem.)
- For **writes to a not-yet-existing file**, realpath the *deepest existing ancestor* and re-append the
  remaining segments, then re-check containment (the `resolveParentRealpath` step) so a non-existent path
  can't bypass the symlink check by failing `realpath`.
- Use `path.relative` segment logic, **not** `real.startsWith(jailReal)` — the latter is the classic
  `"/jail-evil"` prefix bug.
- `O_NOFOLLOW` on the final `open` for writes is a defense-in-depth addition if we want to also block a
  symlink swapped in *between* resolve and open (residual TOCTOU); flagged as a hardening option, not
  required for the smallest version because the realpath check already covers the create path.

**The runtime NEVER opens a path that did not pass `resolveInsideJail`. It NEVER writes to `missionRepoRoot`.**

---

## 3. Command execution (argv-array spawn, exact allowlist)

### Spawn discipline

- Use `node:child_process` **`execFile`/`spawn` with an argv array** — NEVER `exec`, NEVER `sh -c`,
  NEVER string interpolation. `shell: false` is explicit. This removes shell metacharacter injection
  entirely (no globbing, no `;`/`&&`/`$()`/backticks reaching a shell).
- `cwd: jailReal` always. `windowsHide: true`. `timeout: perCommandTimeoutMs` with
  `killSignal: 'SIGKILL'`. `maxBuffer` set to `maxOutputBytes` so a runaway command can't OOM the worker.
- The command + args come from a **fixed table**, not from the model. The model may only select a
  table *key* (e.g. `"typecheck"`); it can never supply raw argv.

### The allowlist (exact-match table, derived from package scripts)

Derived from `package.json` (`/Users/chamdom/Develop/kosta/SyncSpace/package.json:11-27`) and
`server/package.json:11-18`. Each entry is `key → { argv, label }`, run via the package manager with
the jail as cwd. All are read-or-verify only; none mutate the repo, none deploy.

| Key                 | argv (no shell)                                              | Source script |
|---------------------|-------------------------------------------------------------|---------------|
| `typecheck`         | `pnpm ['typecheck']`                                         | root `typecheck` (`package.json:12`) |
| `lint`              | `pnpm ['--filter','server','lint']`                          | server `lint` (`server/package.json:13`) |
| `server:typecheck`  | `pnpm ['--filter','server','typecheck']`                     | server `typecheck` (`server/package.json:12`) |
| `server:test`       | `pnpm ['--filter','server','test']`                          | server `test` → `vitest run` (`server/package.json:18`) |
| `verify:frontend`   | `pnpm ['verify:frontend']`                                   | `package.json:13` |
| `verify:backend`    | `pnpm ['verify:backend']`                                    | `package.json:14` |
| `git:status`        | `git ['-C', jailReal, '-c','core.hooksPath=/dev/null','status','--porcelain']` | read-only |
| `git:diff`          | `git ['-C', jailReal, '-c','core.hooksPath=/dev/null','diff']`                  | read-only |

Rules:
- **Exact-match only.** A request for any key not in the table is rejected before spawn (emit a
  `command_run` with `status:failed`, `stderrTail:"command not allowlisted"`).
- `pnpm` is resolved to an absolute binary path at startup (PATH lookup once), so the child does not
  depend on an attacker-influenced PATH.
- For `git:*` the jail is pinned with `-C jailReal` (read-only sub-commands only — `status`, `diff`).
  No `git add/commit/push/checkout/reset/clean` is ever in the table.
- **Explicitly NOT allowlisted:** the root `build`, `verify:all`, `db:*`, `dev*`, `preview`, `test:*`
  variants beyond `server:test`, anything invoking network, anything that writes outside the worktree,
  and `pnpm install` (see §4 network note). `build`/`verify:frontend` run `vite build` which writes
  only inside the jail's `dist/` — acceptable (output stays in the worktree, torn down with it).

### Capture + result shape

- Capture stdout/stderr up to `maxOutputBytes`; keep the **tail** (last 64 KiB) so the failing end of a
  long log survives. Record `exitCode`, `signal`, wall time.
- Emit a `command_run` event: `{ kind:'command_run', command: <label>, cwd: jailReal, status, exitCode,
  stdoutTail, stderrTail, startedAt, endedAt }` (matches `engineeringEvents.ts:45-57`).
- For test keys (`server:test`, `verify:*`) additionally parse the tail for a pass/fail summary and emit
  a `test_result` event (§5). Parsing is best-effort and **degrades safely** — on no-match, emit
  `test_result` with just `status` inferred from `exitCode` (0 → passed, non-zero → failed) and `suite`
  set to the key. No throw.

---

## 4. Environment hardening (scrubbed, allowlisted child env)

The child process gets a **constructed env, never `process.env` spread**. This is the single most
important control against secret exfiltration, because every secret the server holds is in `process.env`
(`config.ts` reads `ANTHROPIC_API_KEY`, `AGENT_TOKEN_PEPPER`, `AUTH_SECRET`, `DATABASE_URL`, etc. at
`config.ts:50-62`).

```
function buildChildEnv(jailReal: string): NodeJS.ProcessEnv {
  // Start EMPTY. Add back only what a toolchain needs to run offline.
  const allow = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'TZ', 'TERM']
  const env: NodeJS.ProcessEnv = {}
  for (const k of allow) if (process.env[k] != null) env[k] = process.env[k]
  env.HOME = jailReal                        // contain any tool that writes to $HOME
  env.npm_config_offline = 'true'            // pnpm refuses network
  env.npm_config_prefer_offline = 'true'
  env.CI = '1'                               // deterministic, non-interactive
  env.NO_COLOR = '1'
  // pnpm store: point at a prebuilt, read-only store so installs are unnecessary (see note).
  return env
}
```

**Explicit denylist (never passed, guaranteed by starting empty):** `ANTHROPIC_API_KEY`,
`AGENT_TOKEN_PEPPER`, `AUTH_SECRET`, `DATABASE_URL`, `POSTGRES_URL`, `SUPABASE_*`, `PUBLIC_APP_URL`,
session/cookie secrets — none are in the allow list, so none reach the child. A unit test at Gate 7
asserts the constructed env contains **none** of these keys (regression guard).

**Network for the child:** Node has no per-process network namespace, so we cannot kernel-isolate egress
from inside the worker without containers (out of scope per contract — "no Docker"). Mitigations:
- `npm_config_offline=true` makes `pnpm` fail rather than fetch. The allowlisted commands
  (`typecheck`/`lint`/`test`/`build`) **do not need network** *provided dependencies are already
  installed in the worktree's resolved store* — a worktree shares the repo's `node_modules`/store, so
  `pnpm typecheck` runs offline. **This must be confirmed at Gate 7** by running each allowlisted command
  with network disabled and `npm_config_offline=true`.
- `pnpm install` is deliberately NOT allowlisted, so the agent cannot trigger a dependency fetch.
- **Residual:** a malicious build/test script in the dependency tree could still attempt egress (it runs
  as the worker user). This is the irreducible "we run the repo's own code" risk; documented in the risk
  register as R-5 with residual = accept-with-monitoring, and is the reason this whole runtime is
  flag-OFF and gated. True egress prevention requires a sandbox/container (BLOCKED for the smallest
  version — see §10).

---

## 5. The agent loop (bounded tool-use) and event mapping

`liveRuntime` today is text-only and single-shot (`server/src/agents/liveRuntime.ts:34-56`); the provider
only reads `type === 'text'` blocks (`anthropicProvider.ts:63-67`). The coding loop is NEW and minimal.

### 5.1 Provider seam extension (additive, backward-compatible)

Extend `ModelProvider` (`server/src/agents/providers/types.ts`) with an **optional** tool-use shape so
the existing text-only `complete` path is untouched:

```
interface ToolDef { name: string; description: string; input_schema: object }
interface ToolUseBlock { type:'tool_use'; id:string; name:string; input:unknown }
interface ModelTurnInput extends ModelCompleteInput { tools?: ToolDef[]; messages: ModelMessage[] }
interface ModelTurnResult { stopReason: string; text: string; toolUses: ToolUseBlock[] }
// new optional method; provider w/o it → coding runtime unavailable (fail closed)
ModelProvider.turn?(input: ModelTurnInput): Promise<ModelTurnResult>
```

In `anthropicProvider`, `turn` posts the same Messages endpoint **with** a `tools` array and reads BOTH
`text` and `tool_use` content blocks (today it filters them out at `anthropicProvider.ts:63-67`). Tool
results are fed back as `role:'user'` content blocks on the next turn. This is the only provider change.

### 5.2 The three tools (all jailed)

| Tool          | Input                          | Maps to                                   | Emits |
|---------------|--------------------------------|-------------------------------------------|-------|
| `read_file`   | `{ path }`                     | `resolveInsideJail` → `fs.readFile` (cap size) | (none, or `agent_status`) |
| `write_file`  | `{ path, content }`            | `resolveInsideJail` → compute unified diff vs prior → `fs.writeFile` | `file_edit` |
| `run_command` | `{ key }` (allowlist key only) | §3 command runner                          | `command_run` (+ `test_result` for test keys) |

- `write_file` computes a **unified diff** (old vs new content; a tiny dependency-free differ or
  `git -C jail diff -- <path>` after write) and emits `file_edit` with `unifiedDiff`, `additions`,
  `deletions`, `summary` (`engineeringEvents.ts:34-43`). The diff is what Mission View's file_edit
  renderer already consumes (MVP 2.1).
- Every iteration boundary emits an `agent_status` (`{role,status,currentAction,path?}`) so the roster/
  pipeline panes animate. Optionally emit `pipeline_stage` transitions (planning→implementation→testing).

### 5.3 Loop bounds (defense against runaway / cost / prompt-injected churn)

```
for (let i = 0; i < maxIterations; i++) {
  if (ctx.signal.aborted || Date.now() - start > wallClockMs) break   // wall-clock ceiling
  const turn = await provider.turn({ system, messages, tools, maxTokens, timeoutMs })
  appendAssistant(turn)
  if (turn.toolUses.length === 0) break                                // model is done
  for (const call of turn.toolUses) {
    const result = await runToolJailed(call)   // throws JailError → becomes a tool_result error, not a crash
    appendToolResult(call.id, result)
  }
  // optional: cap cumulative tokens via result.usage and break when exceeded
}
await emit.engineering(finalDiffArtifact)      // §6
await emit.status('TASK_STATE_COMPLETED' | 'TASK_STATE_FAILED', summary)
```

- **Bounded by all three of:** `maxIterations` (default 12), `wallClockMs` (default 300_000) checked
  every iteration AND already enforced by the worker's `AbortController` (`agentTaskWorker.ts:53-54` —
  note: the worker timeout is currently 60s at `agentTaskWorker.ts:15`; coding tasks need the longer
  ceiling, so the worker must use a per-task timeout for coding tasks or the loop's own wall clock).
- Tool errors (jail violation, non-allowlisted command, timeout) are returned to the model as a
  `tool_result` with `is_error:true` — they NEVER throw out of `run` (same resilience contract as
  `liveRuntime`'s try/catch at `liveRuntime.ts:42-45`, so the worker process stays alive and the job is
  not retried in a loop).
- A jailed tool failure is also surfaced as a `command_run`/`file_edit` event with a failed status so the
  Mission View shows the rejection (good for the demo + auditability).

---

## 6. Final diff artifact (no merge, no push)

At the end of a run (success or partial), produce the authoritative artifact for the verifier:

```
const diff = await runCommand('git:diff')      // git -C jailReal -c core.hooksPath=/dev/null diff
await emit.artifact({ artifactId: `mission-${taskId}.diff`, name: 'Mission diff',
                      parts: [{ text: diff.stdoutTail }] })
await emit.engineering({ kind:'vcs_event', action:'commit'? -> NO. Use file_edit summary + artifact only })
```

- The final diff is `git diff` of the worktree against `HEAD` — captured as an **artifact** (reusing
  `addTaskArtifact` via `emit.artifact`, `agentTaskWorker.ts:61-69`) and visible in Mission View.
- **NO auto-merge, NO push, NO commit, NO write back to `missionRepoRoot`.** The worktree (and thus the
  diff's working tree) is destroyed at teardown (§2); only the captured diff text survives as an
  artifact. A human/verifier applies it manually if approved. `vcs_event` with `action:'commit'` or
  `pr_opened` is **not** emitted by the runtime in 2.2 (no real commit/PR happens) — emitting it would be
  a false claim, which the contract forbids ("no fake claims of real execution").

---

## 7. Failure / rollback / flag semantics

- **Default OFF.** `MISSION_RUNTIME_ENABLED` absent/false ⇒ `getAgentRuntime` never returns the coding
  runtime; the worker path is identical to today. Mock and plain-live deployments are unaffected.
- **Gate 7 fails ⇒ ship with the flag off.** Mission View + the 7 engineering events + the demo
  (MVP 2.0/2.1) are independent of this runtime and remain fully functional; the demo seeds events via
  `emit.engineering` with `demo:true` and never touches the spawn/jail layer.
- **Workspace always cleaned up** via the `finally` teardown (§2) regardless of success, throw, timeout,
  or abort; `worktree prune` + an optional startup sweep handle hard-crash orphans.
- **Kill switch parity:** because selection is a pure config conjunction, flipping `MISSION_RUNTIME_ENABLED=false`
  and restarting is a complete, instant disable with zero code change — the rollback path is "set env, redeploy".
- **No retry storms:** errors are caught inside `run` (per §5.3), so a failing coding task ends FAILED
  once and is not re-queued in a loop (same guarantee `liveRuntime` already provides).

---

## 8. Threat model (escalation risks → specific mitigation)

Each maps to a row in `risk-register.md`. Severity here is *pre-mitigation*.

| # | Threat | Vector | Specific mitigation |
|---|--------|--------|---------------------|
| T-1 | **Path traversal / jail escape** (read or write outside workspace) | model supplies `../../etc/passwd`, an absolute path, or a symlink inside the jail pointing out | `resolveInsideJail` (§2): reject absolute/NUL, `fs.realpath` to collapse symlinks+`..`, `path.relative` segment containment check (not `startsWith`); write-create path realpaths the deepest existing ancestor; optional `O_NOFOLLOW`. Worktree lives under `os.tmpdir()`, never under the source tree. |
| T-2 | **Command injection** | model-influenced text reaches a shell | argv-array `execFile`/`spawn`, `shell:false`, **fixed command table keyed by an enum** — the model supplies only a key, never argv; no string concatenation ever reaches a process (§3). |
| T-3 | **Env / secret exfiltration** | child reads `ANTHROPIC_API_KEY`/`DATABASE_URL`/`AUTH_SECRET`/`AGENT_TOKEN_PEPPER`/`SUPABASE_*` and posts them out | child env is **constructed from empty** with a 7-key allow list; `HOME=jail`; Gate-7 test asserts no secret key present (§4). Secrets are never on the child's argv either. |
| T-4 | **Network egress** | agent or a dependency script calls out (data exfil / SSRF / fetching a payload) | `npm_config_offline=true`, `pnpm install` not allowlisted, allowlisted commands confirmed to run offline (Gate 7). **Residual** (a dep's own postinstall/test script) is irreducible without a container — documented, accepted-with-monitoring, and the reason the runtime is flag-OFF (§4, §10). |
| T-5 | **Resource exhaustion** (CPU/mem/disk/time) | infinite loop, fork bomb via a script, huge file writes, log flood | per-command `timeout` + `SIGKILL` (120s), `maxBuffer`=64 KiB, loop `maxIterations`=12 + `wallClockMs`=300s + worker `AbortSignal`, output captured as bounded tail, temp tree removed at teardown. (Hard kernel cgroup limits are a container-only control — BLOCKED in smallest version.) |
| T-6 | **Writing outside the jail / corrupting the main checkout** | direct write, or git op that mutates `missionRepoRoot` | all writes go through `resolveInsideJail`; only read-only `git status/diff` allowlisted (no `add/commit/checkout/reset/clean`); worktree is `--detach` so no branch moves; `core.hooksPath=/dev/null` so repo hooks don't fire (§2, §3). |
| T-7 | **Prompt-injected destructive command** | task text / file content tells the model "run rm -rf / push to origin" | the model **cannot express** a destructive command — it can only pick an allowlist key, and the table contains no destructive/network/VCS-write entry (§3). Worst case it picks `git:diff` repeatedly (bounded by T-5). |
| T-8 | **Worktree admin-dir coupling** | writes into the shared `.git/worktrees/<id>` could perturb the parent repo | jail root is the worktree working tree; `.git` in a linked worktree is a *file* pointer, and `resolveInsideJail` blocks climbing to the real `.git` dir (it resolves outside the jail). Read-only git invoked via `-C` with hooks disabled. Residual is low; called out as W-1. |
| T-9 | **Provider tool-use abuse / cost blowup** | model loops emitting tool calls forever | iteration + wall-clock + token caps (§5.3); each turn re-checks `ctx.signal`; provider `timeoutMs` per turn. |

---

## 9. Boot-time + invariant checks (fail-closed)

- `assertMissionRuntimeConfig` in `readConfig` (`config.ts`): if `MISSION_RUNTIME_ENABLED=true`, require
  `AGENT_RUNTIME_MODE=live`, a resolvable `git` binary, and `missionRepoRoot` being a git work-tree;
  otherwise **throw at boot** (mirrors `assertAgentRuntimeConfig`, `config.ts:124-132`). This prevents a
  half-configured coding runtime from ever running.
- `pnpm`/`git` absolute paths resolved once at startup; if absent while the flag is on → boot fails.
- Every filesystem entry point asserts the path came from `resolveInsideJail`; every process entry point
  asserts the key came from the allowlist table. These are cheap runtime assertions, not just review notes.

---

## 10. What CANNOT be made safe in the smallest version (BLOCKED → stays flag-off / out of scope)

- **Kernel-level network egress isolation for the child.** Without a container/namespace (contract: no
  Docker), a dependency's own script can attempt egress. Mitigated (offline pnpm, no install) but not
  *prevented*. → R-5 residual = accept-with-monitoring; this alone justifies flag-OFF-by-default.
- **Hard CPU/mem cgroup limits.** Node `timeout`/`maxBuffer` bound a single command but not a forked
  grandchild's total resource use. → container-only; out of scope.
- **Untrusted-repo execution.** This design assumes the worktree is of *our own* repo. Running arbitrary
  third-party repos would massively widen T-4/T-5 and is explicitly out of scope.
- **Any write-back to the main checkout / merge / push / deploy.** Forbidden by contract; not designed.

If Gate 6 reviewers judge T-4/T-5 residuals unacceptable even with the flag, the runtime stays
**design-only** and Phase 7 is not attempted — Mission View + events + demo already deliver the
user-visible product without it.

---

## 11. Smallest-first PR (the minimal safe surface for Phase 7)

A single, reviewable, flag-OFF PR. Touches the agent layer + config only; **no DB, no mapper, no
frontend** (all already done).

1. **`server/src/config.ts`** — add `missionRuntimeEnabled` + the 5 numeric knobs + `missionRepoRoot`,
   `assertMissionRuntimeConfig`. (~30 lines, mirrors existing patterns.)
2. **`server/src/agents/runtime.ts`** — add `engineering(event: EngineeringEvent)` to `AgentEmitter`;
   add `'coding'` consideration to `AgentRuntimeMode` usage (type stays `'mock'|'live'`, the coding
   selection is the flag conjunction, so no enum churn needed).
3. **`server/src/agents/codingRuntime.ts`** (NEW) — the bounded loop, importing:
   - `server/src/agents/workspace.ts` (NEW): `createWorktreeJail` / `teardown` / `resolveInsideJail`.
   - `server/src/agents/commandRunner.ts` (NEW): the allowlist table + argv `execFile` + capture + env scrub.
   - `server/src/agents/codingTools.ts` (NEW): `read_file`/`write_file`/`run_command` + diff computation.
4. **`server/src/agents/providers/types.ts` + `anthropicProvider.ts`** — add optional `turn(...)` with
   tool-use blocks (additive; text path untouched).
5. **`server/src/agents/registry.ts`** — the `{ coding }` branch (§1), guarded by the flag conjunction.
6. **`server/src/workers/agentTaskWorker.ts`** — implement `emit.engineering` (§1.3); detect coding tasks
   (§1.2) and pass `{ coding:true }`; use the longer per-task timeout for coding tasks.
7. **Tests (Gate 7):** jail-escape (symlink, `..`, absolute) rejected; non-allowlisted command rejected;
   env-scrub asserts no secret keys; per-command timeout kills; offline run of each allowlisted command
   green; teardown removes the worktree on success AND on thrown error; flag-OFF ⇒ behavior identical to
   today; final `git diff` artifact emitted; engineering events round-trip through `appendEvent`→mapper→SSE.

Order of landing within the PR (smallest provable unit first): workspace+jail (with tests) →
commandRunner (with tests) → tools → provider `turn` → loop → registry/worker wiring. Each layer is
independently testable, and the runtime is unreachable in prod until step 5+6 AND the env flag are on.

