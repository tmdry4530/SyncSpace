# OMX_AUTOPILOT_PROMPT.md

Recommended controlled flow:

```text
$plan
Read AGENTS.md, PROJECT_SPEC.md, ARCHITECTURE.md, TASKS.json, STATE_MANAGEMENT.md, API_CONTRACTS.md, REALTIME_SPEC.md, and TEST_PLAN.md. Create a full implementation plan. Do not edit files yet.
```

Then:

```text
$ralph
Implement the approved SyncSpace MVP plan. Follow AGENTS.md strictly. Update TASKS.json and STATUS.md after each task group. Record tradeoffs in DECISIONS.md and repeated failures in FAILURES.md. Run pnpm install, lint, typecheck, test, and build before completion.
```

Aggressive full automation:

```text
autopilot: Implement the full SyncSpace MVP from AGENTS.md and the docs in this repository. Use TASKS.json as work breakdown. Implement frontend, realtime server, Supabase schema/RLS, shared contracts, tests, and README. Run verification commands and fix failures before final report.
```
