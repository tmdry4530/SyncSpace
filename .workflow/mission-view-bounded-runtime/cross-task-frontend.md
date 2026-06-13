# Cross-Task Mission Aggregation — Frontend

**Branch:** `feature/mission-view-v2`  
**Verify exit code:** `pnpm verify:frontend` → **0** (tsc + vite build, 1967 modules)  
**Mutations in src/features/missions:** **zero** (`grep postBackendJson|mutation|mutate` → no output)

---

## Route param change

| File | Before | After |
|---|---|---|
| `src/app/router/routes.ts:11` | `mission(workspaceId, taskId = ':taskId')` | `mission(workspaceId, contextId = ':contextId')` |
| `src/app/router/router.tsx:39` | `path: '/w/:workspaceId/mission/:taskId'` | `path: '/w/:workspaceId/mission/:contextId'` |

The URL shape `/w/:workspaceId/mission/:contextId` is now live. All callers of `routes.mission(wid, id)` pass the context ID as the second argument — confirmed via grep (only `MissionList.tsx` is a caller).

---

## New types

**`src/shared/types/missions.ts`** (new file)

- `MissionSummaryMeta` — `{ contextId, workspaceId, channelId, createdAt }`
- `MissionEvent` — `{ seq, taskId, type, createdAt, payload: Record<string,unknown>|null }`
- `MissionTaskSummary` — `{ taskId, agentId, statusState, title, createdAt }`
- `MissionAgentSummary` — `{ agentId, slug, displayName, role }`
- `MissionDetailResponse` — `{ mission, events, tasks, agents }` (mirrors `GET /api/missions/:contextId`)
- `WorkspaceMissionSummary` — `{ contextId, channelId, title, agentCount, eventCount, updatedAt, createdAt }`
- `WorkspaceMissionsResponse` — `{ missions }` (mirrors `GET /api/workspaces/:id/missions`)

All fields typed as `string`, `number`, or `string | null`. No `any` in public types. No server imports.

---

## Two new queries

### `src/features/missions/queries/useMissionDetailQuery.ts`

Wraps `GET /api/missions/:contextId` via `getBackendJson<MissionDetailResponse>`.  
Uses `realtimePolling.refetchInterval` (same as `useTaskDetailQuery`).  
`staleTime: 1_000`. Disabled when `contextId` is falsy.  
Exports shared `missionKeys` (`all`, `detail(contextId)`, `list(workspaceId)`).

### `src/features/missions/queries/useWorkspaceMissionsQuery.ts`

Wraps `GET /api/workspaces/:workspaceId/missions` via `getBackendJson<WorkspaceMissionsResponse>`.  
Uses `realtimePolling.refetchInterval`. `staleTime: 5_000` (list is less volatile).  
Disabled when `workspaceId` is falsy.

---

## Files changed

| File | Change |
|---|---|
| `src/features/missions/hooks/useMissionQuery.ts` | Re-pointed from `useTaskDetailQuery` → `useMissionDetailQuery`. Derive logic (pipeline stages, agent roster) is unchanged — `unwrapEvent` and the two Maps are identical. Added `EngineeringTaskEvent` re-export alias for backward compat with `MissionTimeline` / `EventDetail`. |
| `src/features/missions/components/MissionView.tsx` | Reads `contextId` param (was `taskId`). Title derived from `detail.tasks[0].title` with contextId short-form fallback. |
| `src/features/missions/components/MissionList.tsx` | Replaced `useAgentTasksQuery` with `useWorkspaceMissionsQuery`. Renders one row per mission (context), linking to `routes.mission(workspaceId, contextId)`. Loading/empty states preserved. |

---

## Read-only confirmation

`grep -rn "postBackendJson|mutation|mutate" src/features/missions` → **no output**.  
All queries in `src/features/missions` are `useQuery` only. No `useMutation`, no `postBackendJson`, no `DELETE`/`PUT`/`POST` calls.

---

## Demo mission

The seeded engineering-story mission (contextId logged by `pnpm seed:demo`) is context-scoped. Navigating to `/w/<workspaceId>/mission/<contextId>` hits `GET /api/missions/:contextId`, which returns all 12 engineering events in `seq` order. The unchanged `deriveMissionData` loop processes them into `pipelineStages` and `agentRoster` maps, and `MissionTimeline` renders the full story. `tasks` and `agents` arrays degrade safely (empty arrays if absent from response).
