# Demo Mission Story — Phase 5

## Overview

A seeded DEMO mission named **"DEMO · 결제 모듈 추가"** is inserted once during
`pnpm --filter server db:seed`.  All events carry `demo: true` and flow through
the real `appendEvent` path, so the existing Mission View at
`/w/:workspaceId/mission/:taskId` renders them identically to live agent output.
No tools actually ran; the data is illustrative engineering fiction.

## How to reach the demo URL

After running `pnpm --filter server db:seed` the seeder prints a line like:

```
DEMO mission seeded — open the Mission View at:
http://localhost:5173/w/<workspaceId>/mission/<taskId>
```

Copy the printed URL into your browser while the dev server is running.  The IDs
are real UUIDs generated at seed time, so each fresh DB will produce different
values.

## 12-step engineering story → event mapping

| # | Narrative | Event kind(s) |
|---|-----------|---------------|
| 1 | Orchestrator analyses task, assigns agents | `agent_status` (orchestrator) + `pipeline_stage` (planning → active) |
| 2 | Planner writes spec, planning done | `agent_status` (planner) + `pipeline_stage` (planning → done) |
| 3 | Builder starts implementation, creates `payment.ts` | `pipeline_stage` (implementation → active) + `agent_status` (builder) + `file_edit` (+28 lines) |
| 4 | Tester runs full suite — 1 test fails | `pipeline_stage` (testing → active) + `agent_status` (tester) + `command_run` (exitCode 1) |
| 5 | Test result recorded — 12 passed, 1 failed | `test_result` (status: failed) |
| 6 | Builder reads failure output | `agent_status` (builder, "테스트 실패 원인 분석 중") |
| 7 | Builder adds `amount > 0` guard | `file_edit` (+3 lines) |
| 8 | Reviewer leaves warning: null check missing | `review_comment` (severity: warn) |
| 9 | Builder improves null-guard error message | `file_edit` (+2 / -2) + `agent_status` |
| 10 | All 13 tests pass | `command_run` (exitCode 0) + `test_result` (status: passed, 13 passed) |
| 11 | Reviewer approves | `review_comment` (verdict: approve, severity: info) |
| 12 | PR opened, orchestrator signals ready for merge | `pipeline_stage` (merge → active) + `vcs_event` (pr_opened) + `agent_status` (orchestrator, done) |

Total events appended: **17** (some steps emit 2-3 events).

## demo:true labeling

Every payload object in `server/src/demo/missionDemo.ts` includes `demo: true`.
The field is declared `optional` in `CommonFields` inside `engineeringEvents.ts`
so it passes `parseEngineeringEvent` cleanly.  A code comment at the top of the
file reads:

> "illustrative demo data, no real tool execution"

## Verify

```bash
# Type-check only server
cd /Users/chamdom/Develop/kosta/SyncSpace
pnpm --filter server typecheck

# Demo mission test only
pnpm --filter server exec vitest run demoMission

# Full regression suite
pnpm verify:all
```

## Source files

| File | Purpose |
|------|---------|
| `server/src/demo/missionDemo.ts` | `seedDemoMission()` — builds and persists all 17 events |
| `server/src/db/seed.ts` | Calls `seedDemoMission()` after demo agent registration |
| `server/test/demoMission.test.ts` | 6 assertions: task exists, ≥12 events, all `demo:true`, all parse, all 7 kinds present, REST round-trip |
