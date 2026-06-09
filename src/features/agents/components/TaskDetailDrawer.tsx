import { useState } from 'react'
import { X } from 'lucide-react'
import type { A2aMessage, A2aTaskState } from '../../../shared/types/contracts'
import { useTaskDetailQuery } from '../queries/useTaskDetailQuery'
import { useCancelTaskMutation } from '../mutations/useCancelTaskMutation'
import { AgentStatusBadge } from './AgentStatusBadge'
import { ArtifactViewer } from './ArtifactViewer'
import { formatTaskTime, messageText, taskTitle } from '../taskContent'
import { taskStateLabel } from '../agentDisplay'

type DrawerTab = 'overview' | 'messages' | 'events' | 'artifacts'

const ACTIVE_STATES: ReadonlySet<A2aTaskState> = new Set<A2aTaskState>([
  'TASK_STATE_SUBMITTED',
  'TASK_STATE_WORKING',
  'TASK_STATE_INPUT_REQUIRED',
  'TASK_STATE_AUTH_REQUIRED'
])

interface TaskDetailDrawerProps {
  taskId: string
  workspaceId: string
  onClose: () => void
}

export function TaskDetailDrawer({ taskId, workspaceId, onClose }: TaskDetailDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('overview')
  const { data, isLoading, error } = useTaskDetailQuery(taskId)
  const cancelTask = useCancelTaskMutation(workspaceId)

  const task = data?.task
  const events = data?.events ?? []
  const canCancel = task ? ACTIVE_STATES.has(task.status.state) : false

  return (
    <aside className="task-drawer" aria-label="에이전트 작업 상세">
      <header className="task-drawer-header">
        <div>
          <p className="eyebrow">에이전트 작업</p>
          <h2>{task ? taskTitle(task) : '작업 상세'}</h2>
          {task ? <AgentStatusBadge state={task.status.state} /> : null}
        </div>
        <button className="task-drawer-close" onClick={onClose} type="button" aria-label="닫기">
          <X size={16} />
        </button>
      </header>

      <nav className="task-drawer-tabs" role="tablist">
        {(
          [
            ['overview', '개요'],
            ['messages', '메시지'],
            ['events', '이벤트'],
            ['artifacts', '산출물']
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
            type="button"
            role="tab"
            aria-selected={tab === key}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="task-drawer-body">
        {isLoading && !task ? <p className="agent-empty-note">작업을 불러오는 중...</p> : null}
        {error ? <p className="form-error" role="alert">작업을 불러오지 못했습니다.</p> : null}

        {task && tab === 'overview' ? (
          <div className="task-overview">
            <dl>
              <div>
                <dt>상태</dt>
                <dd>{taskStateLabel(task.status.state)}</dd>
              </div>
              <div>
                <dt>업데이트</dt>
                <dd>{formatTaskTime(task.status.timestamp) || '-'}</dd>
              </div>
              <div>
                <dt>컨텍스트</dt>
                <dd>{task.contextId.slice(0, 12)}</dd>
              </div>
            </dl>
            {task.status.message ? (
              <div className="task-status-message">
                <p className="eyebrow">최근 상태 메시지</p>
                <p>{messageText(task.status.message)}</p>
              </div>
            ) : null}
            {canCancel ? (
              <button
                className="button ghost small"
                disabled={cancelTask.isPending}
                onClick={() => cancelTask.mutate({ taskId })}
                type="button"
              >
                {cancelTask.isPending ? '취소 중...' : '작업 취소'}
              </button>
            ) : null}
          </div>
        ) : null}

        {task && tab === 'messages' ? <MessagesTab history={task.history ?? []} /> : null}

        {task && tab === 'events' ? (
          <ul className="task-event-list">
            {events.length === 0 ? <p className="agent-empty-note">표시할 이벤트가 없습니다.</p> : null}
            {events.map((event) => (
              <li key={event.seq}>
                <span className="task-event-type">{event.type}</span>
                <time>{formatTaskTime(event.createdAt)}</time>
              </li>
            ))}
          </ul>
        ) : null}

        {task && tab === 'artifacts' ? <ArtifactViewer artifacts={task.artifacts ?? []} /> : null}
      </div>
    </aside>
  )
}

function MessagesTab({ history }: { history: A2aMessage[] }) {
  if (history.length === 0) {
    return <p className="agent-empty-note">아직 주고받은 메시지가 없습니다.</p>
  }
  return (
    <ul className="task-message-list">
      {history.map((message) => (
        <li key={message.messageId} className={message.role === 'ROLE_AGENT' ? 'from-agent' : 'from-user'}>
          <span className="task-message-role">{message.role === 'ROLE_AGENT' ? '에이전트' : '사용자'}</span>
          <p>{messageText(message)}</p>
        </li>
      ))}
    </ul>
  )
}
