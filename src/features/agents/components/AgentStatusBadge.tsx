import type { A2aTaskState, AgentRuntimeStatus } from '../../../shared/types/contracts'
import {
  agentStatusLabel,
  agentStatusTone,
  taskStateLabel,
  taskStateTone
} from '../agentDisplay'

interface AgentStatusBadgeProps {
  status?: AgentRuntimeStatus
  state?: A2aTaskState
}

export function AgentStatusBadge({ status, state }: AgentStatusBadgeProps) {
  if (state) {
    return <span className={`agent-status-badge tone-${taskStateTone(state)}`}>{taskStateLabel(state)}</span>
  }
  if (status) {
    return <span className={`agent-status-badge tone-${agentStatusTone(status)}`}>{agentStatusLabel(status)}</span>
  }
  return null
}
