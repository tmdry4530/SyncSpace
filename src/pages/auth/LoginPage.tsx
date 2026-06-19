import { FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import '../../styles/apple/login.css'
import { routes } from '../../app/router/routes'
import { login, register } from '../../shared/api/authApi'
import { toAppError } from '../../shared/api/errors'
import { useAuthStore } from '../../shared/stores/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const setParticipantId = useAuthStore((state) => state.setParticipantId)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? routes.workspaces

  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [from, navigate, user])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    try {
      const account =
        mode === 'login'
          ? await login({ email, password })
          : await register({ email, password, displayName: email.split('@')[0] ?? email })
      setUser(account.user)
      setParticipantId(account.participantId)
      navigate(from, { replace: true })
    } catch (caught) {
      setError(getAuthErrorMessage(toAppError(caught).message))
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode(next: 'login' | 'signup') {
    setMode(next)
    setError(null)
    setSuccess(null)
  }

  return (
    <main className="ap-login-page">
      <div className="ap-login-frame">
        <section className="ap-login-card">
          <Link className="ap-login-brand" to={routes.home} aria-label="SyncSpace 홈으로">
            <span className="ap-login-brand-badge" aria-hidden="true">S</span>
            <span className="ap-login-brand-name">SyncSpace</span>
          </Link>
          <h1 className="ap-login-title">{mode === 'login' ? '다시 입장하기' : '새 계정 만들기'}</h1>
          <p className="ap-login-copy">제공받은 계정으로 로그인하거나 새 계정을 만들 수 있습니다.</p>

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
              className={mode === 'signup' ? 'ap-login-tab is-active' : 'ap-login-tab'}
              onClick={() => switchMode('signup')}
              role="tab"
              aria-selected={mode === 'signup'}
              type="button"
            >
              가입
            </button>
          </div>

          <form className="ap-login-form" onSubmit={handleSubmit}>
            <label className="ap-login-field">
              <span className="ap-login-label">이메일</span>
              <input
                className="ap-login-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label className="ap-login-field">
              <span className="ap-login-label">비밀번호</span>
              <input
                className="ap-login-input"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
                placeholder="비밀번호"
              />
            </label>
            {error ? <p className="ap-login-error" role="alert">{error}</p> : null}
            {success ? <p className="ap-login-hint" role="status">{success}</p> : null}
            <button className="ap-login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? '처리 중...' : mode === 'login' ? '로그인' : '가입'}
            </button>
          </form>

          <p className="ap-login-hint is-spaced">
            계정으로 로그인하거나, 위의 가입 탭에서 이메일과 비밀번호로 새 계정을 만드세요.
          </p>
        </section>
      </div>
    </main>
  )
}

function getAuthErrorMessage(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid') && normalized.includes('credential')) return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (normalized.includes('already')) return '이미 가입된 이메일입니다. 로그인으로 다시 시도하세요.'
  return message
}
