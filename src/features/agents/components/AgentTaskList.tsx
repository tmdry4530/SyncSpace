import type { A2aTask } from '../../../shared/types/contracts'
import { AgentStatusBadge } from './AgentStatusBadge'
import { formatTaskTime, taskTitle } from '../taskContent'

interface AgentTaskListProps {
  tasks: A2aTask[]
  activeTaskId?: string | null | undefined
  isLoading?: boolean | undefined
  onSelect: (taskId: string) => void
}

export function AgentTaskList({ tasks, activeTaskId, isLoading = false, onSelect }: AgentTaskListProps) {
  if (isLoading && tasks.length === 0) {
    return <p className="agent-empty-note">작업을 불러오는 중...</p>
  }
  if (tasks.length === 0) {
    return <p className="agent-empty-note">아직 실행한 에이전트 작업이 없습니다. 채팅에서 @에이전트를 멘션해 보세요.</p>
  }

  return (
    <ul className="agent-task-list">
      {tasks.map((task) => (
        <li key={task.id}>
          <button
            className={`agent-task-item ${activeTaskId === task.id ? 'active' : ''}`}
            onClick={() => onSelect(task.id)}
            type="button"
          >
            <span className="agent-task-title">{taskTitle(task)}</span>
            <span className="agent-task-meta">
              <AgentStatusBadge state={task.status.state} />
              <time>{formatTaskTime(task.status.timestamp)}</time>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
