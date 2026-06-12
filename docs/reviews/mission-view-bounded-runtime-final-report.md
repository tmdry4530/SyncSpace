# Mission View v2 — bounded-runtime agentic loop — final report

Branch `feature/mission-view-v2` (off `migration/full-agent-a2a-railway`). Autonomous phase-gated loop:
Fable orchestrated; Sonnet implemented; independent Opus agents verified each gate (implementer ≠ verifier
throughout). MVP 2.0 + 2.1 shipped; MVP 2.2 is design-only (security gate); MVP 2.3 designed.

## Outcome
- **MVP 2.0 (event vocabulary + Mission View + rendering): IMPLEMENTED, committed, gated.**
- **MVP 2.1 (readable diff/terminal/test/review/timeline): IMPLEMENTED, committed, gated.**
- **MVP 2.2 (bounded coding runtime): NOT implemented — DESIGN-ONLY / BLOCKED** by independent security Gate 6.
- **MVP 2.3 (multi-agent builder/reviewer loop): DESIGNED only.**

## Final demo route
`/w/:workspaceId/mission/:taskId` — `pnpm db:seed` (and `pnpm dev:full`) seeds a 12-step demo mission and
logs its exact URL (`http://localhost:5173/w/<workspaceId>/mission/<taskId>`). Read-only / spectator-safe.

## Changed files (top)
Backend: `server/migrations/0017_engineering_events.sql` (new), `server/src/a2a/engineeringEvents.ts` (new),
`server/src/a2a/mapper.ts`, `server/src/a2a/types.ts`, `server/src/db/repositories/a2aRepository.ts`,
`server/src/demo/missionDemo.ts` (new), `server/src/db/seed.ts`.
Frontend: `src/features/missions/*` (MissionView, PipelineStepper, AgentRoster, MissionTimeline, EventDetail,
hooks/useMissionQuery, components/renderers/{Diff,Command,TestResult,ReviewComment,VcsEvent,AgentStatus,PipelineStage}Renderer),
`src/shared/types/engineeringEvents.ts` (new), `src/app/router/{routes.ts,router.tsx}`, `src/styles.css`.
Tests: `server/test/{engineeringEvents,demoMission}.test.ts` (new).

## Event types added (on the existing a2a_task_events log, additive enum migration 0017)
`agent_status`, `pipeline_stage`, `file_edit`, `command_run`, `test_result`, `review_comment`, `vcs_event` —
zod-validated discriminated union (`engineeringEvents.ts`), forwarded through `mapEventRowToStreamResponse` +
`GET /api/tasks/:id` + SSE. No parallel realtime/event system was built.

## UI surfaces added
Read-only Mission View: pipeline stepper + agent roster (derived from latest pipeline_stage/agent_status),
chronological timeline with event selection, and a per-kind work surface — unified diff, terminal log,
red/green test summary, grouped review comments, vcs row, plus a raw-JSON inspector and a demo badge.

## MVP 2.2 — why design-only (the blocker)
Gate 6 required BOTH independent Opus verifiers to PASS. Architecture **PASS** (design well-grounded, smallest
first PR feasible, out-of-scope correctly BLOCKED). Security **NEEDS_FIX** — fundamental, not a tweak:
- F-1: a `git worktree` has no `node_modules` (gitignored; pnpm store is outside the repo), so the toolchain
  allowlist can't run; the obvious symlink fix punches a permanent hole through the realpath jail.
- F-2: `pnpm lint/typecheck/verify:*` run `pnpm -r` + `tsc`/`vite build` = executing arbitrary dependency
  code as the worker user → RCE/egress-equivalent, not a reduced residual.
- F-3: child-process network egress is unpreventable without a container, and the network-needing commands
  are the same ones that run untrusted code. Containers are explicitly out of scope.
Per the autonomy policy (no verifier agreement → BLOCKED, continue lower-risk), the bounded runtime is NOT
implemented. The design + risk register are preserved for a future sandboxed implementation.

## Verification (commands run, results)
- `pnpm --filter server typecheck` → exit 0 (each backend phase).
- `pnpm verify:all` (typecheck + vite build + server lint/typecheck/build) → exit 0 (Gate 2, Gate 5).
- `pnpm verify:frontend` → exit 0 (Gate 3/4).
- `pnpm --filter server test` (embedded Postgres 18) → **130/130 (23 files)** at Gate 5; engineeringEvents +
  demoMission round-trip through `GET /api/tasks/:id`; migration 0017 applies cleanly; db.cli/db.schema
  migration-count regressions handled. No MVP1 regression.

## Verifier verdicts
Gate0 PASS, Gate1 PASS (after a RETRY that correctly caught a false "zero-migration" claim → enum-extend),
Gate2 PASS, Gate3 PASS, Gate4 PASS, Gate5 PASS, Gate6 architecture PASS / security NEEDS_FIX → 2.2 design-only.

## Unresolved risks / limitations
- MVP 2.2 real coding execution is blocked on a sandbox/container (the one safe way to run dependency code +
  prevent egress). Without it, "real" file_edit/command_run/test_result events are not produced — the Mission
  View currently renders demo + (future) runtime-emitted events.
- Mission View has no dedicated nav entry yet (reachable by URL; demo URL is logged by seed).
- Frontend has no automated test runner (verified via tsc + vite build only).
- `parseEngineeringEvent` validates the kind discriminator primarily (non-blocking, per Gate 4 note).

## Recommended next PRs
1. **Sandboxed runtime spike** (unblocks 2.2): evaluate a minimal sandbox (e.g. a restricted child sandbox or
   an approved container path) that can run `pnpm test` offline with no egress; re-run Gate 6.
2. **Mission View entry point**: a missions list / link from the workspace so spectators can reach live missions.
3. **2.3 event-emission skeleton** (safe today, no real execution): role-aware mention routing
   (orchestrator→builder→tester→reviewer→verifier) emitting the engineering events, with a per-mission stage
   budget; ready_for_merge decided by an independent verifier agent; NO auto-merge.

## First safe MVP 2.3 PR
The event-emission + handoff skeleton above (no real code execution) — it reuses `mentionDispatcher` + the
shipped engineering events and is buildable + verifiable now, independent of the blocked 2.2 sandbox.

## Ready for agentic continuation?
Yes. MVP 2.0/2.1 are committed + gated on a clean feature branch; 2.2/2.3 designs + risk register are written;
the single hard blocker (sandbox for safe dependency-code execution) is documented with a concrete next step.
