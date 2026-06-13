# Phase 0 — Repository inventory (Mission View v2)

Source: direct file reads this session (orchestrator-authored; the parallel discovery workflow
hung at the Gate-0 transition, but its 5 discovery agents corroborate the seams below). Every
claim cites a file. No implementation done in Phase 0.

## 1. Task + event-sourcing model  →  REUSE (no migration needed for new event kinds)
- `a2a_task_events` rows are the event log: `{ task_id, context_id, event_type, payload (jsonb), seq, visible_to_user, created_at }`. Appended via `appendEvent(...)` in `server/src/db/repositories/a2aRepository.ts`. `seq` gives total order.
- Today's `event_type` vocabulary: `task_snapshot`, `status_update`, `artifact_update`, `message` — written by `server/src/a2a/taskService.ts` (`setTaskStatus` → status_update, `addTaskArtifact` → artifact_update, `addAgentMessage` → message).
- **`payload` is free-form jsonb** (so new payload SHAPES need no migration), BUT `event_type` is a **hard Postgres ENUM** `a2a_event_type` (`server/migrations/0007_a2a_core.sql:113-127`: `task_snapshot|message|status_update|artifact_update|push_delivery|debug`) mirrored by the TS union `A2aEventType` (`a2aRepository.ts:343`) and `appendEvent`'s typed param. The migrate runner is forward-only + checksum-locked (`migrate.ts:80-90`). ⇒ the 7 new engineering kinds REQUIRE **one additive forward-only migration** (`0017`: `ALTER TYPE a2a_event_type ADD VALUE IF NOT EXISTS …` ×7) + extending the TS union + a new `mapEventRowToStreamResponse` case. NOT "zero migration" (corrected after Gate-1 verification).
- Artifacts (`a2a_artifacts`: artifactId/name/parts) exist too but are point-in-time blobs; the **event log is the right home for the engineering timeline**.

## 2. Realtime / SSE stream  →  REUSE
- `server/src/a2a/streaming.ts` = `A2aStreamingHub` over Postgres LISTEN/NOTIFY; `server/src/a2a/routes.ts` `streamTaskEvents()` serves `/a2a/tasks/{id}:subscribe` and `message:stream` (SSE, catch-up + live, `lastSeq` dedup).
- `server/src/a2a/mapper.ts` `mapEventRowToStreamResponse()` maps event rows → wire `StreamResponse`. **Insertion point:** new event types must be passed through here (and the REST task-detail mapper) so the client receives them.
- Per-task stream today (keyed by taskId). A per-mission view subscribes to one task's stream — sufficient for MVP 2.x.

## 3. Task detail REST (the primary Mission View data source)  →  REUSE
- `server/src/http/routes/agentRoutes.ts` `GET /api/tasks/:taskId` already returns `{ task, events: [{ seq, type, createdAt, payload }] }` (events filtered to `visible_to_user`). **This is the cleanest reuse: Mission View fetches task + typed event list here; new event types flow through automatically once mapper forwards them.** Auth: `requireWorkspaceMember` (read OK for human spectators).

## 4. Agent runtime + emit bridge  →  EXTEND emit, runtime is text-only today
- `server/src/agents/runtime.ts`: `AgentEmitter { status, artifact, message, appendDocument }` + `AgentRunContext`.
- `server/src/workers/agentTaskWorker.ts` wires each emit to `appendEvent`/repositories. **New `emit.fileEdit/command/testResult/reviewComment/vcs` map straight onto `appendEvent` with the new event_type** — same pattern.
- `server/src/agents/liveRuntime.ts` is **text-only, NO tools** (single `provider.complete` → message+artifact). This is the gap for MVP 2.2 (a tool-using coding agent). `mockRuntimes.ts` = deterministic templates (good base for demo events).

## 5. Frontend routes + reusable UI  →  new read-only route, reuse fetch/SSE hooks
- Routes in `src/app/router/` (`routes.ts`). Workspace pages in `src/pages/workspace/*`; workbench is `WorkspaceSplitPage.tsx` (chat+doc 2-pane after AgentRail removal). `TaskDetailDrawer` (`src/features/agents/components/`) still exists and already renders a task's events/artifacts — **reuse/extend rather than build fresh**.
- API clients in `src/shared/api/*`. SSE/Yjs realtime consumed via `src/features/realtime/*`. **Insertion point:** add `/workspace/:workspaceId/mission/:taskId` (read-only Mission View) reusing the task-detail fetch + event stream.

## 6. Tests + verification commands
- vitest + **embedded Postgres** (no Docker); helpers `server/test/helpers/{embeddedPostgres,testServer,agentFixture}.ts`. Pattern: boot embedded PG, `startTestServer`, `registerAgentFixture`, `apiRequest`. Frontend has **no test runner** (assert via tsc + vite build).
- Gate commands: `pnpm typecheck` · `pnpm verify:frontend` (tsc + vite build) · `pnpm verify:backend` (lint+typecheck+build) · `pnpm verify:all` · `pnpm --filter server test`.
- `.gitignore` excludes `test/`, `*.test.*`, `*.md` ⇒ **new test/doc files need `git add -f`**.

## Gate 0 self-assessment (to be independently verified by Opus before any code)
- existing event path identified: YES (`a2a_task_events.payload` jsonb + `appendEvent` + `mapEventRowToStreamResponse` + `GET /api/tasks/:id`).
- UI insertion point identified: YES (`/workspace/:id/mission/:taskId`, reuse TaskDetailDrawer + realtime hooks).
- verification commands identified: YES (above).
- no implementation done: YES (only `.workflow/` docs + empty `feature/mission-view-v2` branch).
- **single reuse recommendation:** model engineering events as new `event_type` ENUM values on `a2a_task_events` (one additive migration `0017` for the enum + payload jsonb), extend the TS `A2aEventType` union, add `mapEventRowToStreamResponse` cases (unknown types are currently `default: return null` ⇒ silently dropped — `mapper.ts:90`), and forward through `GET /api/tasks/:id` + SSE into a new read-only Mission View route reusing the existing task-detail fetch. Do NOT build a parallel event/realtime system.
