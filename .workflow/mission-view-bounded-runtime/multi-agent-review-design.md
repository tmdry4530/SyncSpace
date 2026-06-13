# Phase 8 — MVP 2.3 multi-agent builder/reviewer loop (DESIGN ONLY)

Goal: a real multi-agent engineering loop whose every step surfaces in the Mission View via the
Phase-2 engineering events. **Build on what exists — do not invent a new orchestration system.**

## Reuse foundation (already shipped)
- `server/src/agents/mentionDispatcher.ts` — first-party agents already hand work to each other by
  `@slug` with a durable hop counter (MAX_HOPS=3, ≤2 mentions/msg), self-mention guard, verified+healthy
  gating. This IS the orchestration substrate.
- `server/src/a2a/engineeringEvents.ts` + `appendEvent` — the 7 event kinds the loop emits.
- `server/src/workers/agentTaskWorker.ts` `AgentEmitter` — where emits map to events.
- MVP 2.2 bounded runtime (design-only/BLOCKED) — when/if enabled, the builder's `file_edit`/`command_run`
  /`test_result` come from REAL execution; until then they are runtime-emitted illustrative or text-derived.

## The loop (no new infra; orchestration = mentions + events)
1. **orchestrator** receives the mission, emits `pipeline_stage{planning,active}` + `agent_status`, decomposes,
   and `@builder`s the implementation request (existing dispatcher creates the builder task in-channel).
2. **builder** task: emits `agent_status{implementation}`, performs the change (2.2 runtime when enabled →
   real `file_edit` + `command_run`; otherwise a proposed diff), emits `pipeline_stage{implementation,done}`,
   then `@tester`.
3. **tester** task: emits `command_run` (test command) + `test_result`. On fail → `@builder` (back to step 2,
   hop+1); on pass → `pipeline_stage{testing,done}` + `@reviewer`.
4. **reviewer** task: emits `review_comment`(s) (file:line, severity). If `request_changes` → `@builder`
   (hop+1); if `approve` → `review_comment{verdict:approve}` + `@verifier` (or orchestrator).
5. **verifier** (a distinct reviewer-role agent, NOT the builder): independently checks the final state and
   decides `ready_for_merge` → emits `vcs_event{action:pr_opened}` + `pipeline_stage{merge,done}`. 
6. **NO auto-merge to main.** The loop ends at "ready for merge"; a human (or an explicit, separately-gated
   action) performs the actual merge. The mission's final artifact is the diff + the event timeline.

## Runaway / safety (reuse + extend)
- Durable hop bound (MAX_HOPS) already caps builder↔reviewer ping-pong; per-channel rate cap as backstop.
- Add a per-mission **stage budget** (e.g. ≤N build/test/review cycles) recorded in task metadata, so a loop
  that never converges stops with `pipeline_stage{review,failed}` instead of churning. (DB-authoritative,
  mirroring the hop counter — not in-memory.)
- Reviewer/verifier MUST be a different participant than the builder (the dispatcher's self-mention guard +
  a role check) so "review" is independent — the same implementer≠verifier discipline as this whole loop.
- All bounded-runtime constraints from 2.2 (workspace jail, allowlist, no secrets/egress, no auto-merge)
  apply to the builder's execution; 2.3 does NOT relax them and does NOT enable multi-agent real execution
  until 2.2 is unblocked (container/sandbox).

## Integration points (for a future implementation PR — NOT now)
- `mentionDispatcher.ts`: add role-aware routing (orchestrator→builder→tester→reviewer→verifier) + the
  per-mission stage budget; keep all existing guards.
- `livePrompts.ts`: role prompts that instruct each agent to emit the right engineering events and to hand
  off to exactly the next role.
- `agentTaskWorker.ts`: ensure each role's emits flow to `appendEvent` (already true for the new emit hooks
  added in 2.2 design).
- A `mission_stage_budget` field in task metadata (no schema migration — metadata is jsonb).

## Conditional on 2.2
Real multi-agent CODING (not just event emission) depends on the 2.2 bounded runtime, which is currently
DESIGN-ONLY/BLOCKED (Gate 6 security: dependency-code execution needs a container; containers are out of
scope). So 2.3 is **design-only** and its real-execution variant is **blocked on the same sandbox work as 2.2**.
The event-emission + handoff skeleton (without real execution) is buildable today and is the recommended
first 2.3 PR.
