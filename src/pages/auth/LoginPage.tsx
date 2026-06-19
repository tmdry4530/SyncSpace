import { FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import '../../styles/apple/login.css'
import { routes } from '../../app/router/routes'
import { getSupabaseClient } from '../../shared/api/supabaseClient'
import { ensureUserProfile } from '../../shared/api/profiles'
import { toAppError } from '../../shared/api/errors'
import { useAuthStore } from '../../shared/stores/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useAuthStore((state) => state.session)
  const setSession = useAuthStore((state) => state.setSession)
  const setLoading = useAuthStore((state) => state.setLoading)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? routes.workspaces

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setLoading(false)
      return
    }
    let alive = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setSession(data.session)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [setLoading, setSession])

  useEffect(() => {
    if (session) navigate(from, { replace: true })
  }, [from, navigate, session])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    const supabase = getSupabaseClient()
    if (!supabase) {
      setError('Supabase 환경변수를 먼저 설정하세요.')
      setSubmitting(false)
      return
    }

    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { displayName: email.split('@')[0] } } })

    setSubmitting(false)
    if (result.error) {
      setError(getAuthErrorMessage(toAppError(result.error).message))
      return
    }

    if (result.data.user) {
      void ensureUserProfile(result.data.user).catch(() => undefined)
    }

    if (mode === 'signup' && !result.data.session) {
      setSuccess('가입 요청이 접수되었습니다. 이메일 확인이 필요한 프로젝트라면 받은 편지함을 확인하세요.')
      setMode('login')
      return
    }

    navigate(from, { replace: true })
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
                minLength={6}
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
            로컬 Supabase seed를 적용한 경우에만 <code>ada@syncspace.dev / password123</code> 계정을 사용할 수 있습니다.
          </p>
        </section>
      </div>
    </main>
  )
}

function getAuthErrorMessage(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (normalized.includes('email not confirmed')) return '이메일 확인이 필요합니다. 받은 편지함을 확인하세요.'
  if (normalized.includes('user already registered')) return '이미 가입된 이메일입니다. 로그인으로 다시 시도하세요.'
  return message
}
