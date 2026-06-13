# Phase 2 deliverable — engineering event schema (IMPLEMENTED, Gate 2 PASS)

Source of truth: `server/src/a2a/engineeringEvents.ts` (zod schemas + guards + `EngineeringEvent` union).
Stored on the existing `a2a_task_events` log (no parallel infra).

## What shipped
- `server/migrations/0017_engineering_events.sql` — additive `ALTER TYPE a2a_event_type ADD VALUE IF NOT EXISTS` ×7 (agent_status, pipeline_stage, file_edit, command_run, test_result, review_comment, vcs_event). Applies cleanly inside the migrate transaction on embedded PG 18.
- `a2aRepository.ts` `A2aEventType` union extended by the 7 strings; `appendEvent` unchanged otherwise.
- `engineeringEvents.ts` — discriminated union on `kind` (= event_type), each with `agentId`/`timestamp`/optional `demo?:boolean`. Exports `EngineeringEvent`, `EngineeringEventKind`, `ENGINEERING_EVENT_TYPES`, `isEngineeringEventType`, `EngineeringEventSchema`, `parseEngineeringEvent`.
- `types.ts` — `StreamResponse` gains `{ engineeringEvent: EngineeringEvent }`.
- `mapper.ts` — `mapEventRowToStreamResponse` forwards the 7 kinds via `isEngineeringEventType` → `{ engineeringEvent: payload }`; the existing 4 cases are untouched; `visible_to_user` gate intact.

## Wire shape (IMPORTANT for Phase 3/4 renderers)
`GET /api/tasks/:taskId` returns `events: [{ seq, type, createdAt, payload }]` where for engineering events `payload = { engineeringEvent: <EngineeringEvent> }`. The Mission View renderer must read `type` (the event_type) and UNWRAP `payload.engineeringEvent`. Demo events carry `demo:true` (UI badge).

## Verification (Gate 2, independent opus a4fde752)
- `pnpm verify:all` exit 0. Full server suite **123 passed (22 files)**. `engineeringEvents.test.ts` proves migration applies + round-trip via REST on embedded PG; `db.cli`/`db.schema` migration-count assertions updated (17 migrations). No MVP1 regression.
