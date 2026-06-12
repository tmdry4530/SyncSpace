# Phase 3 — Mission View Shell (implementation record)

## Route added

`/w/:workspaceId/mission/:taskId`

Registered in `src/app/router/router.tsx` as a top-level protected route (sibling of the
WorkspaceShell tree, not a child — so it renders full-screen without the sidebar).
Helper added to `src/app/router/routes.ts`:

```ts
mission: (workspaceId = ':workspaceId', taskId = ':taskId') =>
  `/w/${workspaceId}/mission/${taskId}`
```

---

## Files created

| Path | Purpose |
|---|---|
| `src/shared/types/engineeringEvents.ts` | Frontend-only TS mirror of server `engineeringEvents.ts`. Discriminated union of all 7 engineering event types. No server import. `parseEngineeringEvent()` type-guard. |
| `src/features/missions/hooks/useMissionQuery.ts` | Wraps `useTaskDetailQuery` (reuses existing React Query + polling). Unwraps `payload.engineeringEvent` from each event row, derives `pipelineStages` (Map<stage, latest PipelineStageEvent>) and `agentRoster` (Map<agentId, latest AgentStatusEvent>). |
| `src/features/missions/components/PipelineStepper.tsx` | Renders 5-stage ordered list (planning→implementation→testing→review→merge). Status derived from `pipelineStages` map; unknown stages default to `pending`. |
| `src/features/missions/components/AgentRoster.tsx` | One row per agentId from `agentRoster` map. Shows role, status, currentAction, demo badge. |
| `src/features/missions/components/MissionTimeline.tsx` | Chronological list of all engineering events. Each row: icon + kind label + one-line summary + relative time. Clickable (button role + keyboard). `demo` badge shown when present. |
| `src/features/missions/components/EventDetail.tsx` | Detail pane for selected event. Phase 3: readable field list per kind (no `any` leaks). `file_edit` also shows raw unifiedDiff, `command_run` shows stdout/stderr tails, `test_result` shows failure list. Safe fallback (`JSON.stringify`) for unknown kinds. |
| `src/features/missions/components/MissionView.tsx` | Page root. Three-column layout: left=PipelineStepper+AgentRoster, center=EventDetail, right=MissionTimeline. Manages `selectedSeq` state. Read-only — no mutations, spectator-safe. |

## Files changed

| Path | Change |
|---|---|
| `src/app/router/routes.ts` | Added `mission()` helper |
| `src/app/router/router.tsx` | Lazy-imported `MissionView`; added `/w/:workspaceId/mission/:taskId` route |
| `src/styles.css` | Appended ~270 lines of scoped mission-view CSS using existing design tokens (`--bg`, `--surface`, `--accent`, `--line`, `--muted`, `--radius`, etc.) |

---

## How pipeline / roster / timeline derive from events

All derivation lives in `useMissionQuery.ts`:

1. **Payload unwrap**: each `TaskEvent` whose `type` is an engineering event kind has
   `payload = { engineeringEvent: <EngineeringEvent> }`. The hook calls
   `parseEngineeringEvent(payload['engineeringEvent'])` to get a typed value.

2. **Pipeline stages**: iterate events in seq order; for each `pipeline_stage` event, write into
   `Map<stage, PipelineStageEvent>`. Because iteration is forward, the last write for a stage wins
   (highest-seq = latest state).

3. **Agent roster**: same pattern for `agent_status` — `Map<agentId, AgentStatusEvent>`.

4. **Timeline**: the filtered+typed `engineeringEvents[]` array (all 7 kinds, seq order) is passed
   directly to `MissionTimeline`; no extra derivation.

---

## verify:frontend result

```
> tsc -p tsconfig.json --noEmit && vite build

vite v8.0.10 building client environment for production...
✓ 1958 modules transformed.
dist/assets/MissionView-C5ONU2S-.js   15.65 kB │ gzip: 4.12 kB
✓ built in 349ms
```

**Exit code: 0** — zero TypeScript errors, zero build errors.

Existing routes and pages are unaffected (WorkspaceShell and all workspace children unchanged).
