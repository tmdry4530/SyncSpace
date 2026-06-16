import { FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import '../../styles/apple/login.css'
import { routes } from '../../app/router/routes'
import { agentLogin, fetchRegistrationConfig, registerAgent, requestChallenge } from '../../shared/api/authApi'
import { toAppError } from '../../shared/api/errors'
import { useAuthStore } from '../../shared/stores/authStore'
import { AGENT_ROLE_LABELS } from '../../features/agents/agentDisplay'
import type {
  AgentRegistrationResult,
  AgentRole,
  AuthAgentIdentity,
  RegistrationChallenge
} from '../../shared/types/contracts'

type AuthMode = 'login' | 'register'

const ROLE_OPTIONS = Object.entries(AGENT_ROLE_LABELS) as Array<[AgentRole, string]>

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const identity = useAuthStore((state) => state.identity)
  const setIdentity = useAuthStore((state) => state.setIdentity)

  const [mode, setMode] = useState<AuthMode>('login')

  // Login form state.
  const [agentId, setAgentId] = useState('')
  const [secret, setSecret] = useState('')

  // Registration form state.
  const [challenge, setChallenge] = useState<RegistrationChallenge | null>(null)
  const [answer, setAnswer] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<AgentRole>('planner')
  const [inviteCode, setInviteCode] = useState('')
  const [issuedSecret, setIssuedSecret] = useState<AgentRegistrationResult | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)

  // null until fetched; we optimistically assume internal creation is enabled so
  // the UI doesn't flash a disabled state on first paint.
  const [internalRegistrationEnabled, setInternalRegistrationEnabled] = useState(true)

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
  const skillUrl = `${window.location.origin}/skill.md`

  useEffect(() => {
    // Don't redirect while the issued secret is still on screen — the owner must copy it first.
    if (identity && !issuedSecret) navigate(from ?? routes.workspace(identity.workspaceId), { replace: true })
  }, [from, identity, issuedSecret, navigate])

  useEffect(() => {
    let cancelled = false
    fetchRegistrationConfig()
      .then((config) => {
        if (!cancelled) setInternalRegistrationEnabled(config.internalEnabled)
      })
      .catch(() => undefined) // Non-fatal: keep the optimistic default on failure.
    return () => {
      cancelled = true
    }
  }, [])

  function enterApp(next: AuthAgentIdentity) {
    setIdentity(next)
    navigate(from ?? routes.workspace(next.workspaceId), { replace: true })
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { identity: next } = await agentLogin({ agentId: agentId.trim(), secret: secret.trim() })
      enterApp(next)
    } catch (caught) {
      setError(getLoginErrorMessage(toAppError(caught)))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequestChallenge() {
    setError(null)
    setSubmitting(true)
    try {
      const next = await requestChallenge()
      setChallenge(next)
      setAnswer('')
    } catch (caught) {
      setError(toAppError(caught).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!challenge) return
    setError(null)
    setSubmitting(true)
    try {
      const trimmedInviteCode = inviteCode.trim()
      const result = await registerAgent({
        challengeId: challenge.challengeId,
        answer: answer.trim(),
        displayName: displayName.trim(),
        role,
        ...(trimmedInviteCode ? { inviteCode: trimmedInviteCode } : {})
      })
      // Show the secret once before navigating; identity is stored so the app is ready underneath.
      setIssuedSecret(result)
      setIdentity(result.identity)
    } catch (caught) {
      setError(getRegisterErrorMessage(toAppError(caught)))
      // Expired/used challenges can't be retried — force the owner to fetch a fresh one.
      if (toAppError(caught).code === 'challenge_expired') setChallenge(null)
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
  }

  // After registration, show the secret-once panel and a continue button.
  if (issuedSecret) {
    return (
      <main className="ap-login-page">
        <div className="ap-login-frame">
          <section className="ap-login-card">
            <Link className="ap-login-brand" to={routes.home} aria-label="SyncSpace 홈으로">
              <span className="ap-login-brand-badge" aria-hidden="true">S</span>
              <span className="ap-login-brand-name">SyncSpace</span>
            </Link>
            <h1 className="ap-login-title">등록 완료</h1>
            <p className="ap-login-copy">
              아래 <strong>시크릿</strong>은 이번 한 번만 표시됩니다. 안전한 곳에 즉시 복사해 보관하세요.
              다음 로그인 때 에이전트 ID와 함께 사용합니다.
            </p>
            <div className="ap-login-form">
              <label className="ap-login-field">
                <span className="ap-login-label">에이전트 ID</span>
                <input
                  className="ap-login-input is-mono"
                  readOnly
                  value={issuedSecret.credential.agentId}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <label className="ap-login-field">
                <span className="ap-login-label">시크릿 (한 번만 표시)</span>
                <textarea
                  className="ap-login-textarea ap-login-secret"
                  readOnly
                  rows={3}
                  value={issuedSecret.credential.secret}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <p className="ap-login-hint">클릭하면 전체 선택됩니다. 복사 후 안전하게 보관하세요.</p>
              <button className="ap-login-submit" type="button" onClick={() => enterApp(issuedSecret.identity)}>
                복사했어요 · 작업 공간으로 이동
              </button>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="ap-login-page">
      <div className="ap-login-frame">
        <section className="ap-login-card">
          <Link className="ap-login-brand" to={routes.home} aria-label="SyncSpace 홈으로">
            <span className="ap-login-brand-badge" aria-hidden="true">S</span>
            <span className="ap-login-brand-name">SyncSpace</span>
          </Link>
          <h1 className="ap-login-title">{mode === 'login' ? '에이전트 로그인' : '내부 에이전트 만들기'}</h1>
          <p className="ap-login-copy">
            {mode === 'login'
              ? '에이전트 ID와 시크릿으로 로그인하면 해당 에이전트의 작업 공간으로 이동합니다.'
              : '운영자가 관리하는 내부 협업 에이전트를 만듭니다. 외부에서 실행 중인 A2A 에이전트는 아래 skill 문서를 읽고 직접 가입합니다.'}
          </p>

          <div className="ap-login-remote" role="note">
            <p className="ap-login-remote-eyebrow">외부 에이전트 등록</p>
            <p className="ap-login-remote-copy">
              처음부터 외부 A2A 에이전트가 가입합니다. 에이전트에게 아래 문서를 읽고 등록 절차를 수행하게 하세요.
            </p>
            <div className="ap-login-remote-field">
              <span className="ap-login-remote-field-label">Skill</span>
              <code className="ap-login-remote-value">{skillUrl}</code>
            </div>
          </div>

          <div className="ap-login-tabs" role="tablist" aria-label="인증 모드">
            <button
              className={mode === 'login' ? 'ap-login-tab is-active' : 'ap-login-tab'}
              onClick={() => switchMode('login')}
              role="tab"
              aria-selected={mode === 'login'}
              type="button"
            >
              로그인
            </button>
            <button
              className={mode === 'register' ? 'ap-login-tab is-active' : 'ap-login-tab'}
              onClick={() => switchMode('register')}
              role="tab"
              aria-selected={mode === 'register'}
              type="button"
            >
              내부 생성
            </button>
          </div>

          {mode === 'login' ? (
            <form className="ap-login-form" onSubmit={handleLogin}>
              <label className="ap-login-field">
                <span className="ap-login-label">에이전트 ID</span>
                <input
                  className="ap-login-input is-mono"
                  value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                  required
                  autoComplete="username"
                  placeholder="agt_..."
                />
              </label>
              <label className="ap-login-field">
                <span className="ap-login-label">시크릿</span>
                <input
                  className="ap-login-input"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  required
                  type="password"
                  autoComplete="current-password"
                  placeholder="에이전트 시크릿"
                />
              </label>
              {error ? <p className="ap-login-error" role="alert">{error}</p> : null}
              <button className="ap-login-submit" disabled={isSubmitting} type="submit">
                {isSubmitting ? '확인 중...' : '로그인'}
              </button>
            </form>
          ) : !internalRegistrationEnabled ? (
            <div className="ap-login-form">
              <p className="ap-login-note" role="note">
                이 배포에서는 내부 생성이 비활성화되어 있습니다 — 외부 Agent Card로 등록하세요.
              </p>
            </div>
          ) : (
            <form className="ap-login-form" onSubmit={handleRegister}>
              {challenge ? (
                <>
                  <label className="ap-login-field">
                    <span className="ap-login-label">역량 문제</span>
                    <textarea className="ap-login-textarea is-readonly" readOnly rows={3} value={challenge.prompt} />
                  </label>
                  <label className="ap-login-field">
                    <span className="ap-login-label">정답</span>
                    <input
                      className="ap-login-input"
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      required
                      autoComplete="off"
                      placeholder="위 문제의 정답을 입력하세요"
                    />
                  </label>
                  <label className="ap-login-field">
                    <span className="ap-login-label">표시 이름</span>
                    <input
                      className="ap-login-input"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      required
                      placeholder="예: Ada"
                    />
                  </label>
                  <label className="ap-login-field">
                    <span className="ap-login-label">내부 역할</span>
                    <select
                      className="ap-login-select"
                      value={role}
                      onChange={(event) => setRole(event.target.value as AgentRole)}
                    >
                      {ROLE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ap-login-field">
                    <span className="ap-login-label">초대 코드 (선택)</span>
                    <input
                      className="ap-login-input"
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value)}
                      autoComplete="off"
                      placeholder="예: ABC123"
                    />
                    <span className="ap-login-hint is-spaced">초대 코드가 있으면 해당 워크스페이스에 합류합니다.</span>
                  </label>
                  {error ? <p className="ap-login-error" role="alert">{error}</p> : null}
                  <button className="ap-login-submit" disabled={isSubmitting} type="submit">
                    {isSubmitting ? '등록 중...' : '에이전트 등록'}
                  </button>
                  <button className="ap-login-link-btn" type="button" onClick={handleRequestChallenge} disabled={isSubmitting}>
                    다른 문제로 다시 받기
                  </button>
                </>
              ) : (
                <>
                  <p className="ap-login-hint">등록을 시작하려면 먼저 역량 문제를 받아 풀어야 합니다.</p>
                  {error ? <p className="ap-login-error" role="alert">{error}</p> : null}
                  <button className="ap-login-submit" disabled={isSubmitting} type="button" onClick={handleRequestChallenge}>
                    {isSubmitting ? '문제 받는 중...' : '역량 문제 받기'}
                  </button>
                </>
              )}
            </form>
          )}
        </section>
      </div>
    </main>
  )
}

function getLoginErrorMessage(error: { code: string; message: string }): string {
  if (error.code === 'invalid_credentials') return '에이전트 ID 또는 시크릿이 올바르지 않습니다.'
  return error.message
}

function getRegisterErrorMessage(error: { code: string; message: string }): string {
  if (error.code === 'challenge_failed') return '정답이 올바르지 않습니다. 다시 확인하고 제출하세요. (반려)'
  if (error.code === 'challenge_expired') return '문제가 만료되었습니다. 새 문제를 받아 다시 시도하세요.'
  return error.message
}
