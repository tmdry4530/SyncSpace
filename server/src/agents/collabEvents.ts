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
import { parseEngineeringEvent } from '../a2a/engineeringEvents.js'


// ---------- Role → pipeline stage map ----------

type PipelineStage = 'planning' | 'implementation' | 'review'

const ROLE_STAGE: Record<AgentRole, PipelineStage> = {
  orchestrator: 'planning',
  planner: 'planning',
  builder: 'implementation',
  doc_writer: 'implementation',
  reviewer: 'review'
}

export function roleToStage(role: AgentRole): PipelineStage {
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
 * Validate + persist one engineering event.  Never throws out of the worker:
 * any error is logged and swallowed.
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
  await appendEvent({
    taskId,
    contextId,
    eventType: parsed.kind,
    payload: event,
    visibleToUser: true
  })
}

// ---------- Public emitters ----------

/**
 * Emit agent_status(working) + pipeline_stage(active) at task start.
 */
export async function emitAgentStarted(
  taskId: string,
  contextId: string,
  agentId: string,
  role: AgentRole,
  logger?: Logger
): Promise<void> {
  const timestamp = new Date().toISOString()
  const stage = roleToStage(role)

  await appendEngineeringEvent(
    taskId,
    contextId,
    {
      kind: 'agent_status',
      agentId,
      role,
      status: 'working',
      currentAction: ROLE_CURRENT_ACTION[role] ?? '작업 중입니다.',
      timestamp
    },
    logger
  ).catch((err) => logger?.warn('collabEvents: emitAgentStarted agent_status failed', { taskId, error: String(err) }))

  await appendEngineeringEvent(
    taskId,
    contextId,
    {
      kind: 'pipeline_stage',
      agentId,
      stage,
      status: 'active',
      startedAt: timestamp,
      timestamp
    },
    logger
  ).catch((err) => logger?.warn('collabEvents: emitAgentStarted pipeline_stage failed', { taskId, error: String(err) }))
}

/**
 * Emit agent_status(done) + pipeline_stage(done) on successful completion.
 */
export async function emitAgentCompleted(
  taskId: string,
  contextId: string,
  agentId: string,
  role: AgentRole,
  logger?: Logger
): Promise<void> {
  const timestamp = new Date().toISOString()
  const stage = roleToStage(role)

  await appendEngineeringEvent(
    taskId,
    contextId,
    {
      kind: 'agent_status',
      agentId,
      role,
      status: 'done',
      currentAction: '작업 완료.',
      timestamp
    },
    logger
  ).catch((err) => logger?.warn('collabEvents: emitAgentCompleted agent_status failed', { taskId, error: String(err) }))

  await appendEngineeringEvent(
    taskId,
    contextId,
    {
      kind: 'pipeline_stage',
      agentId,
      stage,
      status: 'done',
      endedAt: timestamp,
      timestamp
    },
    logger
  ).catch((err) => logger?.warn('collabEvents: emitAgentCompleted pipeline_stage failed', { taskId, error: String(err) }))
}

/**
 * Emit agent_status(failed) + pipeline_stage(failed) on task failure.
 */
export async function emitAgentFailed(
  taskId: string,
  contextId: string,
  agentId: string,
  role: AgentRole,
  logger?: Logger
): Promise<void> {
  const timestamp = new Date().toISOString()
  const stage = roleToStage(role)

  await appendEngineeringEvent(
    taskId,
    contextId,
    {
      kind: 'agent_status',
      agentId,
      role,
      status: 'failed',
      currentAction: '오류 발생.',
      timestamp
    },
    logger
  ).catch((err) => logger?.warn('collabEvents: emitAgentFailed agent_status failed', { taskId, error: String(err) }))

  await appendEngineeringEvent(
    taskId,
    contextId,
    {
      kind: 'pipeline_stage',
      agentId,
      stage,
      status: 'failed',
      endedAt: timestamp,
      timestamp
    },
    logger
  ).catch((err) => logger?.warn('collabEvents: emitAgentFailed pipeline_stage failed', { taskId, error: String(err) }))
}

/**
 * Emit a review_comment event with the reviewer's actual output text.
 * Only called when role === 'reviewer'.
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
  ).catch((err) => logger?.warn('collabEvents: emitReviewComment failed', { taskId, error: String(err) }))
}
