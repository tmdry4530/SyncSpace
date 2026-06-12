# Cross-Task Mission Aggregation — Backend Implementation

Date: 2026-06-12  
Branch: feature/mission-view-v2

## Summary

A "mission" is now an a2a **context**: all collaboration tasks spawned by a
mention chain (orchestrator → @planner → @builder → @reviewer) join the **same
context**, and a new read-only `/api/missions/:contextId` endpoint returns the
entire context's engineering timeline so the Mission View can show the full
collaboration on one screen.

---

## Files Changed

### 1. `server/src/agents/mentionDispatcher.ts`

- Added `originContextId?: string | null` to `DispatchMentionsInput`.
- In `createCollabTask`, when `originContextId` is set, passes
  `contextId: input.originContextId` to `createTaskFromMessage` so the
  mentioned agent's task joins the SAME context.
- The existing workspace IDOR guard in `createTaskFromMessage`
  (`context.workspace_id !== input.workspaceId → throw`) is preserved —
  collaboration is always same-workspace, so the guard always holds.

### 2. `server/src/workers/agentTaskWorker.ts` (line ~91)

- `dispatchAgentMentions` call now includes `originContextId: task.context_id`
  so every hop in the collaboration chain inherits the origin context.
- Remote replies deliberately do NOT dispatch (the `remoteBridge` path is
  unchanged), so external text still cannot spawn internal tasks.

### 3. `server/src/db/repositories/a2aRepository.ts`

Two new exported functions:

```ts
listEventsByContext(contextId, client?)
// select * from a2a_task_events where context_id = $1 order by seq asc

listContextTasks(contextId, client?)
// select id, agent_id, status_state, title, created_at
// from a2a_tasks where context_id = $1 order by created_at asc
```

`ContextTaskSummaryRow` interface exported alongside.

### 4. `server/src/http/routes/missionRoutes.ts` (NEW)

Two read-only endpoints:

#### `GET /api/missions/:contextId`

Auth: `requireWorkspaceMember(ctx, config, context.workspace_id)`  
— workspace is taken from the **context row**, never from the caller.  
Cross-workspace contextId → `getContext` returns null → 404 (no 403, no workspace disclosure).

Response:
```json
{
  "mission": { "contextId", "workspaceId", "channelId", "createdAt" },
  "events": [{ "seq", "taskId", "type", "createdAt", "payload" }],
  "tasks": [{ "taskId", "agentId", "statusState", "title", "createdAt" }],
  "agents": [{ "agentId", "slug", "displayName", "role" }]
}
```

Events are filtered to `visible_to_user = true` and mapped via
`mapEventRowToStreamResponse` (so engineering events arrive as
`{ engineeringEvent: ... }`). `seq` included so callers can detect ordering.

#### `GET /api/workspaces/:workspaceId/missions`

Auth: `requireWorkspaceMember(ctx, config, workspaceId)` (URL param, same-workspace gate).

Lists all contexts with at least one of the 7 engineering event types, newest
first. Each entry: `contextId`, `channelId`, `title`, `agentCount`,
`eventCount`, `updatedAt`, `createdAt`.

### 5. `server/src/http/app.ts`

`registerMissionRoutes(router, config)` added alongside the other route
registrations.

### 6. `server/src/demo/missionDemo.ts`

`SeedDemoMissionResult` now includes `contextId` as well as `taskId`.
Return value updated: `return { taskId, contextId }`.

### 7. `server/src/db/seed.ts`

Logged Mission View URL updated from task-scoped to context-scoped:
```
http://localhost:5173/w/<workspaceId>/mission/<contextId>
```

### 8. `server/test/missionAggregation.test.ts` (NEW)

Three tests on embedded PG + testServer + agentFixture:

1. **Cross-task aggregation**: creates two tasks sharing one contextId via
   `createTaskFromMessage({ contextId })`, appends engineering events to each,
   asserts `GET /api/missions/:contextId` returns events from both tasks in seq
   order with correct types (`agent_status`, `pipeline_stage`).

2. **Mission list**: asserts `GET /api/workspaces/:id/missions` lists at least
   one mission with `eventCount > 0`.

3. **IDOR guard**: workspace B credential accesses workspace A's contextId →
   asserts HTTP 404.

---

## New Endpoints & Auth Summary

| Endpoint | Auth | IDOR protection |
|---|---|---|
| `GET /api/missions/:contextId` | `requireWorkspaceMember` on `context.workspace_id` (from DB) | 404 for cross-workspace; workspace never disclosed |
| `GET /api/workspaces/:workspaceId/missions` | `requireWorkspaceMember` on URL `workspaceId` | Standard workspace gate |

Both endpoints are **read-only**. No caller-supplied workspace is trusted in
the context endpoint.

---

## How Collaboration Tasks Now Share a Context

Before this PR every call to `createCollabTask` in `mentionDispatcher.ts`
created a **new** context, so orchestrator / planner / builder / reviewer tasks
were in separate contexts and their events were invisible to each other.

After this PR:

1. `agentTaskWorker.ts` passes `originContextId: task.context_id` to
   `dispatchAgentMentions`.
2. `dispatchAgentMentions` forwards it as `contextId` to `createTaskFromMessage`.
3. `createTaskFromMessage` already had the REUSE path: when `contextId` is set
   it validates `context.workspace_id === workspaceId` then creates the new task
   under the existing context.
4. All collaboration tasks in the chain share **one context = one mission**.
5. `listEventsByContext` aggregates events across all tasks in that context,
   ordered by `seq`, giving the Mission View the complete engineering timeline.

---

## Verification Commands & Evidence

```bash
# Typecheck — exit 0
pnpm --filter server typecheck

# Targeted suite — 3 passed
pnpm --filter server exec vitest run missionAggregation

# Smoke + collab regression — 9 passed
pnpm --filter server exec vitest run smoke agents.collab

# Full suite
pnpm --filter server test
```

Results at implementation time:
- `typecheck`: exit 0, 0 errors
- `missionAggregation`: 3/3 passed
- `smoke agents.collab`: 9/9 passed
- Full suite: running (see CI / local output)

---

## Constraints Honoured

- No new infra; reuses `a2aRepository`, `mapper`, `requireWorkspaceMember`,
  `createTaskFromMessage`.
- Minimal diff: 7 files touched, 1 new route file, 1 new test file.
- No frontend changes (separate PR).
- No IDOR weakening: workspace guard in `createTaskFromMessage` untouched;
  mission endpoint gates on context's own workspace.
- No debug/temporary code left.
- `remoteBridge` path unchanged — external text still cannot spawn internal tasks.
