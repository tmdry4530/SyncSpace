import { Link, useParams } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { useAgentTasksQuery } from '../../agents/queries/useAgentTasksQuery'
import { routes } from '../../../app/router/routes'
import type { A2aTask, A2aTaskState } from '../../../shared/types/contracts'

// ── helpers ──────────────────────────────────────────────────────────────────

function taskTitle(task: A2aTask): string {
  const meta = task.metadata?.['title']
  if (typeof meta === 'string' && meta.trim().length > 0) return meta.trim()
  return task.id.slice(0, 12)
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

const STATE_LABELS: Record<A2aTaskState, string> = {
  TASK_STATE_UNSPECIFIED: '알 수 없음',
  TASK_STATE_SUBMITTED: '제출됨',
  TASK_STATE_WORKING: '작업 중',
  TASK_STATE_INPUT_REQUIRED: '입력 필요',
  TASK_STATE_AUTH_REQUIRED: '인증 필요',
  TASK_STATE_COMPLETED: '완료',
  TASK_STATE_FAILED: '실패',
  TASK_STATE_CANCELED: '취소됨',
  TASK_STATE_REJECTED: '거부됨',
}

const STATE_MOD: Record<A2aTaskState, string> = {
  TASK_STATE_UNSPECIFIED: 'idle',
  TASK_STATE_SUBMITTED: 'connecting',
  TASK_STATE_WORKING: 'connected',
  TASK_STATE_INPUT_REQUIRED: 'connecting',
  TASK_STATE_AUTH_REQUIRED: 'connecting',
  TASK_STATE_COMPLETED: 'connected',
  TASK_STATE_FAILED: 'disconnected',
  TASK_STATE_CANCELED: 'idle',
  TASK_STATE_REJECTED: 'disconnected',
}

// ── component ─────────────────────────────────────────────────────────────────

export function MissionList() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { data: tasks, isLoading, error } = useAgentTasksQuery(workspaceId)

  if (isLoading && !tasks) {
    return <div className="page-state">미션 목록을 불러오는 중...</div>
  }

  if (error) {
    return (
      <div className="page-state">
        <p className="form-error" role="alert">미션 목록을 불러오지 못했습니다.</p>
      </div>
    )
  }

  return (
    <div className="mission-list-page">
      <header className="mission-list-header">
        <ClipboardList size={20} aria-hidden="true" />
        <div>
          <p className="eyebrow">Mission View</p>
          <h1>미션</h1>
        </div>
      </header>

      {tasks && tasks.length === 0 ? (
        <div className="mission-list-empty">
          <p>아직 미션이 없습니다 — 에이전트가 작업을 시작하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <ul className="mission-list" role="list">
          {(tasks ?? []).map((task) => {
            const state = task.status.state
            const timestamp = task.status.timestamp
            return (
              <li key={task.id} className="mission-list-item">
                <Link
                  to={routes.mission(workspaceId!, task.id)}
                  className="mission-list-row"
                >
                  <span className="mission-list-title">{taskTitle(task)}</span>
                  <span className={`status-pill ${STATE_MOD[state]}`}>
                    {STATE_LABELS[state]}
                  </span>
                  {timestamp ? (
                    <span className="mission-list-time">{relativeTime(timestamp)}</span>
                  ) : null}
                  <span className="mission-list-id">{task.id.slice(0, 8)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
