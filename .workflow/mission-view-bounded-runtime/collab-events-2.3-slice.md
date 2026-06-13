# MVP 2.3 Collab-Events Slice — Deliverable

Date: 2026-06-12  
Branch: feature/mission-view-v2  

---

## What was built

Real collaboration-progress engineering events now flow into the Mission View
for every internal agent task that runs through `processAgentTaskJob`.

### Files changed

| File | Change |
|---|---|
| `server/src/agents/collabEvents.ts` | New helper — emits agent_status, pipeline_stage, review_comment |
| `server/src/workers/agentTaskWorker.ts` | Wire collabEvents emitters into the worker lifecycle |
| `server/src/a2a/streaming.ts` | Add `engineeringEvent` case to `streamResponseEventName` (bug fix: was falling through to `'artifactUpdate'`) |
| `server/test/collabEvents.test.ts` | New integration + unit tests (15 tests) |

---

## What events are emitted, by which role

### All roles (at task start, around `updateAgentStatus('running')`)
- `agent_status` — `{ agentId, role, status: 'working', currentAction: <Korean description>, timestamp }`
- `pipeline_stage` — `{ agentId, stage: <mapped>, status: 'active', startedAt, timestamp }`

### All roles (on successful completion)
- `agent_status` — `{ ..., status: 'done' }`
- `pipeline_stage` — `{ ..., status: 'done', endedAt }`

### All roles (on failure / catch path)
- `agent_status` — `{ ..., status: 'failed' }`
- `pipeline_stage` — `{ ..., status: 'failed', endedAt }`

### Reviewer role only (after `runtime.run()` returns, using the message text captured via `emit.message`)
- `review_comment` — `{ agentId, path: '', severity: 'info', comment: <reviewer message text, trimmed to 500 chars>, timestamp }`

### Never emitted (no real code execution — 2.2 sandbox is BLOCKED)
- `file_edit`
- `command_run`
- `test_result`

---

## Role → pipeline stage map

| Role | Stage |
|---|---|
| orchestrator | planning |
| planner | planning |
| builder | implementation |
| doc_writer | implementation |
| reviewer | review |

---

## Honesty boundary

These are REAL events — they reflect what actually happens in the worker
lifecycle.  `demo: true` is never set.  The events are only emitted when:

1. `updateAgentStatus('running')` is called — the task is genuinely starting.
2. `runtime.run(ctx)` returns without throwing — the task genuinely succeeded.
3. `emit.message()` is called by the reviewer runtime — the reviewer genuinely
   produced output text.
4. The catch path runs — the task genuinely failed.

`file_edit`, `command_run`, and `test_result` are NOT emitted.  There is no
real code execution in this slice.  The 2.2 bounded runtime is BLOCKED (Gate 6
security: dependency-code execution needs a container, containers are out of
scope).  Emitting fabricated execution events would violate the honesty
constraint stated in the contract.

---

## Single-task scope (and what aggregation follow-up needs)

This slice is single-task scoped: each agent task emits its own role-stage
events to its own context/task.  The `taskId` and `contextId` used are the
task's own — not any parent or mission-wide context.

Aggregating multiple collaboration tasks (orchestrator → builder → reviewer,
which are separate tasks created by `mentionDispatcher`) into ONE mission view
requires context-level event aggregation: all tasks sharing a `contextId` need
their events collected under that context.  This is a follow-up that needs:

1. A context-level event query (not just `listEvents(taskId)`).
2. A way to associate sub-tasks with the originating mission's context.
3. UI changes to query by `contextId` rather than a single `taskId`.

This is intentionally deferred and is not part of the 2.3 slice.

---

## Verification results

### `pnpm --filter server typecheck` — exit 0

```
> server@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
(no output = clean)
```

### `pnpm --filter server exec vitest run collabEvents` — 15/15 passed

```
Test Files  1 passed (1)
     Tests  15 passed (15)
  Duration  1.99s
```

### `pnpm --filter server exec vitest run smoke agents.collab` — 9/9 passed

```
Test Files  2 passed (2)
     Tests  9 passed (9)
  Duration  3.24s
```

### `pnpm --filter server test` (full suite) — 145/145 passed

```
Test Files  24 passed (24)
     Tests  145 passed (145)
  Duration  37.36s
```

### `pnpm verify:all` — exit 0

typecheck + frontend build + backend lint/typecheck/build all passed.

---

## Streaming regression note

The `streamResponseEventName` function in `streaming.ts` had a catch-all
`return 'artifactUpdate'` that was silently misclassifying engineering events
as artifact updates when they were emitted over SSE.  This caused the
`a2a.stream.test.ts` test to fail (it found an `engineeringEvent`-keyed object
where it expected `artifactUpdate.artifact`).  Fixed by adding an
`'engineeringEvent' in response` case before the catch-all.  This was a
pre-existing latent bug exposed by the new events.
