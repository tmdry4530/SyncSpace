# Phase 1 — Implementation contract (Mission View v2)

Authoritative scope for the loop. Principle: **extend the existing a2a event log; build no parallel realtime system.**

## Scope
### MVP 2.0 (implement) — event vocabulary + Mission View + rendering
- Add 7 engineering `event_type`s on `a2a_task_events`. This requires **one additive forward-only migration** `server/migrations/0017_engineering_events.sql` (`ALTER TYPE a2a_event_type ADD VALUE IF NOT EXISTS` ×7 — payload stays free-form jsonb), extending the TS `A2aEventType` union (`a2aRepository.ts:343`) + `appendEvent` signature, NEW `mapEventRowToStreamResponse` cases (today unknown types hit `default: return null` and are dropped — `mapper.ts:90`), and REST/SSE forwarding. Validate the migration runs green on embedded PG 18 at Gate 2.
- New read-only route `/workspace/:workspaceId/mission/:taskId` rendering: pipeline + roster, work surface, chronological timeline, selected-event detail.
- Render demo AND live events through the same schema.

### MVP 2.1 (implement) — readable renderers + interaction
- file_edit → unified-diff view (added/removed lines). command_run → terminal-style log (cmd + stdout/stderr tail + exit). test_result → red/green summary (passed/failed/failures). review_comment → grouped by file:line with severity. vcs_event → branch/commit/PR row. Timeline selection drives a detail pane; raw event JSON inspectable; missing fields degrade safely.

### MVP 2.2 (CONDITIONAL — only if Gate 6 dual-Opus PASS) — smallest bounded coding runtime
- ONE coding agent, operating ONLY inside a task-scoped workspace (temp dir or git worktree of the repo), file R/W jailed to that dir, allowlisted commands only, per-command timeout + max output, emits `agent_status`/`file_edit`/`command_run`/`test_result`, produces a final unified diff for verifier review. **Feature-flagged OFF by default** (`MISSION_RUNTIME_ENABLED=false`). If Gate 7 fails → stays disabled; Mission View + events remain.

### MVP 2.3 (design only) — multi-agent builder/reviewer loop doc.

## Non-goals (explicit)
No parallel event/realtime infra · no multi-agent runtime in 2.2 · no deploy · no auto-merge · no writes to the main checkout from the runtime · no network (unless an allowlisted verify command already needs it AND verifier approves) · no secret/credential access · no Docker/containers (none present) · no full IDE/editing in Mission View (read-only). (Note: ONE additive migration IS required for the event_type enum — see MVP 2.0; "no migration" is NOT a goal.)

## Event schema (payload on a2a_task_events; `kind` mirrors event_type)
Common: `{ kind, agentId, timestamp, demo?: boolean }`. `demo:true` marks mock/demo events (UI shows a "demo" badge; runtime events omit it).
- agent_status: `{ role, status, currentAction, path? }`
- pipeline_stage: `{ stage: planning|implementation|testing|review|merge, status: pending|active|done|failed, startedAt?, endedAt?, summary? }`
- file_edit: `{ path, unifiedDiff, additions?, deletions?, summary }`
- command_run: `{ command, cwd?, status: running|success|failed, exitCode?, stdoutTail?, stderrTail?, startedAt?, endedAt? }`
- test_result: `{ suite, status: passed|failed, passed?, failed?, durationMs?, failures?: [{name, message?}] }`
- review_comment: `{ reviewerId?, path, lineStart?, lineEnd?, severity: info|warn|error, comment, verdict?: approve|request_changes }`
- vcs_event: `{ action: branch_created|commit|pr_opened, branch?, commitSha?, prUrl?, summary? }`
Validation: zod schemas + type guards (repo already uses zod in `a2a/schemas.ts`). Stored via `appendEvent` with `visible_to_user=true`.

## UI surface contract
- Route `/workspace/:workspaceId/mission/:taskId`, read-only (spectator-safe; no writes).
- Data: `GET /api/tasks/:taskId` (task + typed events) for initial load; live updates reuse existing SSE task subscription.
- Layout: left = pipeline stepper + agent roster (from latest agent_status/pipeline_stage); center = work surface (renderer switched by selected event kind); right/bottom = timeline (all events, chronological, clickable).
- Demo events visibly badged; unknown/missing fields render a safe fallback.

## Backend/frontend integration points
- `server/migrations/0017_engineering_events.sql`: additive `ALTER TYPE a2a_event_type ADD VALUE` ×7 (the only migration).
- `server/src/db/repositories/a2aRepository.ts`: extend `A2aEventType` union (line ~343) + `appendEvent` typed param.
- `server/src/a2a/types.ts` (+ a new `engineeringEvents.ts`): event payload types + zod guards.
- `server/src/a2a/mapper.ts` `mapEventRowToStreamResponse`: add cases for the 7 kinds (unknown currently dropped at `default: return null`, line 90) so REST + SSE forward them.
- `server/src/agents/runtime.ts` AgentEmitter + `workers/agentTaskWorker.ts`: optional new emit methods → `appendEvent` (used by demo + future runtime).
- Frontend: `src/app/router/routes.ts` route; `src/features/missions/*` new feature; reuse `src/shared/api` task fetch + `src/features/realtime` SSE.

## Mock/demo strategy
A deterministic demo mission seeds the 12-step engineering story as real `a2a_task_events` with `demo:true`. Same schema as runtime events. Clearly labeled in UI + seed. No fake claims of real execution.

## Command allowlist strategy (for 2.2)
Allowlist derived from package scripts, exact-match only: `pnpm typecheck`, `pnpm --filter server lint`, `pnpm --filter server typecheck`, `pnpm --filter server test`, `pnpm verify:frontend`, `pnpm verify:backend`, `git diff`/`git status` (read-only, pinned `git -C <jail>`). Hardening (required by Gate 6): **argv-array spawn, never a shell string** (no `sh -c`, no metachar interpolation, fixed args); **realpath-checked workspace jail** (resolve symlinks; refuse any path escaping the task workspace root); **scrubbed env** (allowlist env vars; never pass `ANTHROPIC_API_KEY`/`AGENT_TOKEN_PEPPER`/`AUTH_SECRET`/`DATABASE_URL` or other secrets into the child); per-command timeout (120s) + max captured output (e.g. 64 KiB tail); exit code; emits command_run/test_result. No network unless an allowlisted command inherently needs it AND the verifier approves.

## Verification criteria (gates)
- Gate2: migration `0017` applies cleanly on embedded PG 18; `pnpm typecheck` + `pnpm --filter server test` green; new events round-trip through appendEvent → mapper → REST/SSE (not dropped); no duplicate infra.
- Gate3/4: `pnpm verify:frontend` green; each event kind has a distinct readable surface; timeline selection works; safe degradation.
- Gate5: demo tells coherent story; demo clearly labeled; uses real schema.
- Gate6 (2.2 design): dual-Opus PASS on boundary/allowlist/no-main-mutation/no-deploy/no-creds.
- Gate7 (2.2 impl, if reached): `pnpm verify:all` + server suite green; dual-Opus security+architecture PASS; rollback/flag path proven.
- Throughout: MVP 1 surfaces (chat/doc/spectator) unbroken — full `verify:all` + server suite at each implementation gate.
