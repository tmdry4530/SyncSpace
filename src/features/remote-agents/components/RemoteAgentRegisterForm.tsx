import { FormEvent, useState } from 'react'
import { Check, ClipboardCopy, Plus, ShieldCheck } from 'lucide-react'
import { toAppError } from '../../../shared/api/errors'
import type { RemoteAgentRegistrationResult } from '../../../shared/types/contracts'
import { useRegisterRemoteAgentMutation } from '../mutations/useRegisterRemoteAgentMutation'
import { useVerifyRemoteAgentMutation } from '../mutations/useVerifyRemoteAgentMutation'

export function RemoteAgentRegisterForm() {
  const register = useRegisterRemoteAgentMutation()
  const verify = useVerifyRemoteAgentMutation()
  const [agentCardUrl, setAgentCardUrl] = useState('')
  const [pending, setPending] = useState<RemoteAgentRegistrationResult | null>(null)
  const [copiedField, setCopiedField] = useState<'token' | 'url' | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const registerError = register.error ? toAppError(register.error).message : null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const url = agentCardUrl.trim()
    if (!url) return
    setVerifyError(null)
    register.mutate(url, {
      onSuccess: (result) => {
        setPending(result)
        setAgentCardUrl('')
      }
    })
  }

  async function copy(value: string, field: 'token' | 'url') {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1500)
    } catch {
      setCopiedField(null)
    }
  }

  function runVerify() {
    if (!pending) return
    setVerifyError(null)
    verify.mutate(pending.id, {
      onSuccess: (result) => {
        if (result.status === 'verified') {
          setPending(null)
        } else {
          setVerifyError('아직 검증 토큰을 확인하지 못했습니다. 토큰을 게시한 뒤 다시 시도하세요.')
        }
      },
      onError: (error) => setVerifyError(toAppError(error).message)
    })
  }

  return (
    <div className="remote-register">
      <form className="remote-register-form" onSubmit={submit}>
        <label className="remote-register-label" htmlFor="remote-agent-card-url">
          에이전트 카드 URL
        </label>
        <div className="remote-register-row">
          <input
            id="remote-agent-card-url"
            value={agentCardUrl}
            onChange={(event) => setAgentCardUrl(event.target.value)}
            placeholder="https://example.com/.well-known/agent-card.json"
            type="url"
            inputMode="url"
          />
          <button className="button primary" disabled={register.isPending || !agentCardUrl.trim()} type="submit">
            <Plus size={15} />
            등록
          </button>
        </div>
        {registerError ? <p className="form-error compact" role="alert">등록 실패: {registerError}</p> : null}
      </form>

      {pending ? (
        <div className="remote-verify-card" role="status">
          <p className="eyebrow">소유권 검증 (1회성)</p>
          <p className="remote-verify-copy">
            아래 토큰을 검증 URL 위치에 게시한 뒤 <strong>검증</strong>을 누르세요. 이 토큰은 다시 표시되지 않습니다.
          </p>

          <div className="remote-verify-field">
            <span className="remote-verify-field-label">검증 URL</span>
            <code className="remote-verify-value">{pending.verification.url}</code>
            <button
              className="icon-button small"
              onClick={() => void copy(pending.verification.url, 'url')}
              type="button"
              aria-label="검증 URL 복사"
            >
              {copiedField === 'url' ? <Check size={14} /> : <ClipboardCopy size={14} />}
            </button>
          </div>

          <div className="remote-verify-field">
            <span className="remote-verify-field-label">검증 토큰</span>
            <code className="remote-verify-value remote-verify-token">{pending.verification.token}</code>
            <button
              className="icon-button small"
              onClick={() => void copy(pending.verification.token, 'token')}
              type="button"
              aria-label="검증 토큰 복사"
            >
              {copiedField === 'token' ? <Check size={14} /> : <ClipboardCopy size={14} />}
            </button>
          </div>

          {verifyError ? <p className="form-error compact" role="alert">{verifyError}</p> : null}

          <div className="remote-verify-actions">
            <button className="button primary" disabled={verify.isPending} onClick={runVerify} type="button">
              <ShieldCheck size={15} />
              {verify.isPending ? '검증 중...' : '검증'}
            </button>
            <button className="button ghost" onClick={() => setPending(null)} type="button">
              나중에
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
