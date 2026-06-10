import { FormEvent, useState } from 'react'
import { Globe, HeartPulse, Send, ShieldCheck, Trash2 } from 'lucide-react'
import { toAppError } from '../../../shared/api/errors'
import type { RemoteAgentProfile } from '../../../shared/types/contracts'
import { useRemoteAgentsQuery } from '../queries/useRemoteAgentsQuery'
import { useVerifyRemoteAgentMutation } from '../mutations/useVerifyRemoteAgentMutation'
import { useHealthCheckMutation } from '../mutations/useHealthCheckMutation'
import { useDeleteRemoteAgentMutation } from '../mutations/useDeleteRemoteAgentMutation'
import { useInvokeRemoteAgentMutation } from '../mutations/useInvokeRemoteAgentMutation'
import {
  healthStatusLabel,
  healthStatusTone,
  verificationStatusLabel,
  verificationStatusTone
} from '../remoteAgentDisplay'
import { RemoteAgentRegisterForm } from './RemoteAgentRegisterForm'

interface RemoteAgentDirectoryProps {
  workspaceId: string
  channelId?: string | null | undefined
}

export function RemoteAgentDirectory({ workspaceId, channelId }: RemoteAgentDirectoryProps) {
  const { data: remoteAgents = [], isLoading } = useRemoteAgentsQuery(Boolean(workspaceId))

  return (
    <section className="agent-rail-section remote-directory">
      <h2>
        <Globe size={15} />
        외부 에이전트
      </h2>

      <RemoteAgentRegisterForm />

      {isLoading && remoteAgents.length === 0 ? (
        <p className="agent-empty-note">외부 에이전트를 불러오는 중...</p>
      ) : null}
      {!isLoading && remoteAgents.length === 0 ? (
        <p className="agent-empty-note">등록된 외부 에이전트가 없습니다. 에이전트 카드 URL로 등록하세요.</p>
      ) : null}

      <ul className="remote-agent-list">
        {remoteAgents.map((agent) => (
          <RemoteAgentRow key={agent.id} agent={agent} workspaceId={workspaceId} channelId={channelId} />
        ))}
      </ul>
    </section>
  )
}

interface RemoteAgentRowProps {
  agent: RemoteAgentProfile
  workspaceId: string
  channelId?: string | null | undefined
}

function RemoteAgentRow({ agent, workspaceId, channelId }: RemoteAgentRowProps) {
  const verify = useVerifyRemoteAgentMutation()
  const healthCheck = useHealthCheckMutation()
  const remove = useDeleteRemoteAgentMutation()
  const invoke = useInvokeRemoteAgentMutation(workspaceId)
  const [showInvoke, setShowInvoke] = useState(false)
  const [invokeContent, setInvokeContent] = useState('')

  const isVerified = agent.verificationStatus === 'verified'
  const canInvoke = isVerified && agent.healthStatus !== 'unhealthy'
  const actionError =
    verify.error || healthCheck.error || remove.error || invoke.error
      ? toAppError(verify.error || healthCheck.error || remove.error || invoke.error).message
      : null

  function submitInvoke(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = invokeContent.trim()
    if (!content) return
    invoke.mutate(
      { id: agent.id, content, ...(channelId ? { channelId } : {}) },
      {
        onSuccess: () => {
          setInvokeContent('')
          setShowInvoke(false)
        }
      }
    )
  }

  return (
    <li className="remote-agent-item">
      <div className="remote-agent-head">
        <span className="agent-avatar" aria-hidden="true">
          {agent.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="agent-roster-copy">
          <strong>{agent.name}</strong>
          <small>@{agent.slug}</small>
        </span>
      </div>

      {agent.description ? <p className="remote-agent-desc">{agent.description}</p> : null}

      <div className="remote-agent-badges">
        <span className={`agent-status-badge tone-${verificationStatusTone(agent.verificationStatus)}`}>
          {verificationStatusLabel(agent.verificationStatus)}
        </span>
        <span className={`agent-status-badge tone-${healthStatusTone(agent.healthStatus)}`}>
          {healthStatusLabel(agent.healthStatus)}
        </span>
      </div>

      <div className="remote-agent-actions">
        {!isVerified ? (
          <button
            className="button ghost small"
            disabled={verify.isPending}
            onClick={() => verify.mutate(agent.id)}
            type="button"
          >
            <ShieldCheck size={14} />
            검증
          </button>
        ) : null}
        <button
          className="button ghost small"
          disabled={healthCheck.isPending}
          onClick={() => healthCheck.mutate(agent.id)}
          type="button"
        >
          <HeartPulse size={14} />
          상태 확인
        </button>
        {canInvoke ? (
          <button className="button ghost small" onClick={() => setShowInvoke((open) => !open)} type="button">
            <Send size={14} />
            호출
          </button>
        ) : null}
        <button
          className="button ghost small remote-agent-delete"
          disabled={remove.isPending}
          onClick={() => remove.mutate(agent.id)}
          type="button"
          aria-label="삭제"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {showInvoke && canInvoke ? (
        <form className="remote-agent-invoke" onSubmit={submitInvoke}>
          <input
            value={invokeContent}
            onChange={(event) => setInvokeContent(event.target.value)}
            placeholder="이 에이전트에게 보낼 메시지"
            autoFocus
          />
          <button className="button primary small" disabled={invoke.isPending || !invokeContent.trim()} type="submit">
            <Send size={14} />
            보내기
          </button>
        </form>
      ) : null}

      {actionError ? <p className="form-error compact" role="alert">{actionError}</p> : null}
    </li>
  )
}
