/**
 * collabEvents.ts — MVP 2.3 slice
 *
 * Emits real collaboration-progress engineering events (agent_status,
 * pipeline_stage, review_comment) into the a2a_task_events log as each
 * agent task runs.  These are REAL events — they reflect what actually
 * happens in the worker lifecycle.  demo:true is never set here.
 *
 * NOT emitted (no real execution in this slice — 2.2 sandbox is BLOCKED):
 *   file_edit · command_run · test_result
 *
 * SCOPE: single-task.  Each agent task emits its own role-stage events to
 * its own context.  Cross-task aggregation (orchestrator → builder →
 * reviewer into ONE mission view) is a follow-up that needs context-level
 * event aggregation — see collab-events-2.3-slice.md.
 */

import type { Logger } from '../utils/logger.js'
import type { AgentRole } from '../types/contracts.js'
import { appendEvent } from '../db/repositories/a2aRepository.js'
import { parseEngineeringEvent, type EngineeringEvent } from '../a2a/engineeringEvents.js'

// ---------- Role → pipeline stage map ----------

/**
 * Derived from the canonical zod vocabulary: a stage literal that is not in
 * PipelineStageSchema's enum fails the BUILD here, instead of failing zod
 * validation at runtime and silently skipping the emit.
 */
type PipelineStage = Extract<EngineeringEvent, { kind: 'pipeline_stage' }>['stage']

const ROLE_STAGE: Record<AgentRole, PipelineStage> = {
  orchestrator: 'planning',
  planner: 'planning',
  builder: 'implementation',
  doc_writer: 'implementation',
  reviewer: 'review'
}

export function roleToStage(role: AgentRole): PipelineStage {
  // `??` covers roles read from the DB that predate this map.
  return ROLE_STAGE[role] ?? 'planning'
}

// Korean action descriptions per role
const ROLE_CURRENT_ACTION: Record<AgentRole, string> = {
  orchestrator: '에이전트 협업을 조율하는 중입니다.',
  planner: '요구사항을 분석하고 구현 계획을 작성하는 중입니다.',
  builder: '변경안을 작성하는 중입니다.',
  doc_writer: '문서를 정리하는 중입니다.',
  reviewer: '코드/설계를 검토하는 중입니다.'
}

// ---------- Core helper ----------

/**
 * Validate + persist one engineering event.  Truly never throws: validation
 * failures AND database errors are logged and swallowed here, so callers
 * (the worker hot path) never need their own catch — progress telemetry must
 * never break the task lifecycle.
 */
async function appendEngineeringEvent(
  taskId: string,
  contextId: string,
  event: Record<string, unknown>,
  logger?: Logger
): Promise<void> {
  const parsed = parseEngineeringEvent(event)
  if (!parsed) {
    logger?.warn('collabEvents: event failed validation, skipping', { taskId, kind: event['kind'] })
    return
  }
  try {
    await appendEvent({
      taskId,
      contextId,
      eventType: parsed.kind,
      payload: event,
      visibleToUser: true
    })
  } catch (err) {
    logger?.warn('collabEvents: failed to persist engineering event', {
      taskId,
      kind: parsed.kind,
      error: String(err)
    })
  }
}

// ---------- Lifecycle emitters ----------

type LifecyclePhase = 'started' | 'completed' | 'failed'

const LIFECYCLE: Record<
  LifecyclePhase,
  { agentStatus: string; stageStatus: 'active' | 'done' | 'failed'; timeKey: 'startedAt' | 'endedAt' }
> = {
  started: { agentStatus: 'working', stageStatus: 'active', timeKey: 'startedAt' },
  completed: { agentStatus: 'done', stageStatus: 'done', timeKey: 'endedAt' },
  failed: { agentStatus: 'failed', stageStatus: 'failed', timeKey: 'endedAt' }
}

function lifecycleAction(phase: LifecyclePhase, role: AgentRole): string {
  if (phase === 'started') return ROLE_CURRENT_ACTION[role] ?? '작업 중입니다.'
  return phase === 'completed' ? '작업 완료.' : '오류 발생.'
}

/**
 * Emit the agent_status + pipeline_stage pair for one lifecycle phase.
 * The two appends stay sequential on purpose: the pair lands in
 * deterministic seq order for the timeline.
 */
async function emitLifecycle(
  phase: LifecyclePhase,
  taskId: string,
  contextId: string,
  agentId: string,
  role: AgentRole,
  logger?: Logger
): Promise<void> {
  const { agentStatus, stageStatus, timeKey } = LIFECYCLE[phase]
  const timestamp = new Date().toISOString()

  await appendEngineeringEvent(
    taskId,
    contextId,
    {
      kind: 'agent_status',
      agentId,
      role,
      status: agentStatus,
      currentAction: lifecycleAction(phase, role),
      timestamp
    },
    logger
  )

  await appendEngineeringEvent(
    taskId,
    contextId,
    {
      kind: 'pipeline_stage',
      agentId,
      stage: roleToStage(role),
      status: stageStatus,
      [timeKey]: timestamp,
      timestamp
    },
    logger
  )
}

/** Emit agent_status(working) + pipeline_stage(active) at task start. */
export function emitAgentStarted(
  taskId: string,
  contextId: string,
  agentId: string,
  role: AgentRole,
  logger?: Logger
): Promise<void> {
  return emitLifecycle('started', taskId, contextId, agentId, role, logger)
}

/** Emit agent_status(done) + pipeline_stage(done) on successful completion. */
export function emitAgentCompleted(
  taskId: string,
  contextId: string,
  agentId: string,
  role: AgentRole,
  logger?: Logger
): Promise<void> {
  return emitLifecycle('completed', taskId, contextId, agentId, role, logger)
}

/** Emit agent_status(failed) + pipeline_stage(failed) on failure/cancellation. */
export function emitAgentFailed(
  taskId: string,
  contextId: string,
  agentId: string,
  role: AgentRole,
  logger?: Logger
): Promise<void> {
  return emitLifecycle('failed', taskId, contextId, agentId, role, logger)
}

/**
 * Emit a review_comment event with the reviewer's actual output text.
 * Only called when role === 'reviewer' and the task completed.
 * path/line are absent — this slice has no file context.
 */
export async function emitReviewComment(
  taskId: string,
  contextId: string,
  agentId: string,
  commentText: string,
  logger?: Logger
): Promise<void> {
  const timestamp = new Date().toISOString()
  const trimmed = commentText.trim().slice(0, 500)

  await appendEngineeringEvent(
    taskId,
    contextId,
    {
      kind: 'review_comment',
      agentId,
      path: '',
      severity: 'info',
      comment: trimmed || '(리뷰 완료)',
      timestamp
    },
    logger
  )
}
