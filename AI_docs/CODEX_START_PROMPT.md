# CODEX_START_PROMPT.md

```text
You are implementing the full SyncSpace MVP.

Read first:
- AGENTS.md
- PROJECT_SPEC.md
- ARCHITECTURE.md
- TASKS.json
- STATE_MANAGEMENT.md
- API_CONTRACTS.md
- REALTIME_SPEC.md
- TEST_PLAN.md

Then implement the project end-to-end.

This is AI full implementation mode. Create the full pnpm monorepo, frontend, realtime server, Supabase schema/RLS, shared contracts, tests, README, and run docs.

Keep state separation strict:
- Zustand = local UI state
- TanStack Query = Supabase server state
- Yjs/WebSocket = realtime collaboration state

Update TASKS.json and STATUS.md after task groups. Record decisions in DECISIONS.md and repeated failures in FAILURES.md.

Run verification:
- pnpm install
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build

Do not mark complete until checks pass or failures are explicitly documented.
```
