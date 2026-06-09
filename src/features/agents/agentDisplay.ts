import type { A2aTaskState, AgentRole, AgentRuntimeStatus } from '../../shared/types/contracts'

/** Korean labels for A2A task states (per plan). */
export const TASK_STATE_LABELS: Record<A2aTaskState, string> = {
  TASK_STATE_UNSPECIFIED: '알 수 없음',
  TASK_STATE_SUBMITTED: '대기 중',
  TASK_STATE_WORKING: '작업 중',
  TASK_STATE_INPUT_REQUIRED: '추가 입력 필요',
  TASK_STATE_AUTH_REQUIRED: '승인/권한 필요',
  TASK_STATE_COMPLETED: '완료',
  TASK_STATE_FAILED: '실패',
  TASK_STATE_CANCELED: '취소됨',
  TASK_STATE_REJECTED: '거절됨'
}

/** Compact CSS-friendly tone keyword per task state for badge styling. */
export const TASK_STATE_TONE: Record<A2aTaskState, string> = {
  TASK_STATE_UNSPECIFIED: 'neutral',
  TASK_STATE_SUBMITTED: 'pending',
  TASK_STATE_WORKING: 'running',
  TASK_STATE_INPUT_REQUIRED: 'attention',
  TASK_STATE_AUTH_REQUIRED: 'attention',
  TASK_STATE_COMPLETED: 'success',
  TASK_STATE_FAILED: 'danger',
  TASK_STATE_CANCELED: 'neutral',
  TASK_STATE_REJECTED: 'danger'
}

export function taskStateLabel(state: A2aTaskState): string {
  return TASK_STATE_LABELS[state] ?? TASK_STATE_LABELS.TASK_STATE_UNSPECIFIED
}

export function taskStateTone(state: A2aTaskState): string {
  return TASK_STATE_TONE[state] ?? 'neutral'
}

/** Korean labels for agent runtime status. */
export const AGENT_STATUS_LABELS: Record<AgentRuntimeStatus, string> = {
  idle: '대기',
  running: '작업 중',
  waiting_for_input: '추가 입력 필요',
  auth_required: '승인/권한 필요',
  failed: '실패',
  disabled: '비활성'
}

export const AGENT_STATUS_TONE: Record<AgentRuntimeStatus, string> = {
  idle: 'neutral',
  running: 'running',
  waiting_for_input: 'attention',
  auth_required: 'attention',
  failed: 'danger',
  disabled: 'neutral'
}

export function agentStatusLabel(status: AgentRuntimeStatus): string {
  return AGENT_STATUS_LABELS[status] ?? status
}

export function agentStatusTone(status: AgentRuntimeStatus): string {
  return AGENT_STATUS_TONE[status] ?? 'neutral'
}

/** Korean labels for agent roles. */
export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  planner: '플래너',
  builder: '빌더',
  reviewer: '리뷰어',
  doc_writer: '문서 작성',
  orchestrator: '오케스트레이터'
}

export function agentRoleLabel(role: AgentRole): string {
  return AGENT_ROLE_LABELS[role] ?? role
}
