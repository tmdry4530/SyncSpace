import { FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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

  function toggleMode() {
    setMode(mode === 'login' ? 'signup' : 'login')
    setError(null)
    setSuccess(null)
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand-mark" to={routes.home}>SyncSpace</Link>
        <h1>{mode === 'login' ? '다시 입장하기' : '새 계정 만들기'}</h1>
        <p className="auth-copy">제공받은 계정으로 로그인하거나 새 계정을 만들 수 있습니다.</p>
        <p className="auth-hint">로컬 Supabase seed를 적용한 경우에만 <code>ada@syncspace.dev / password123</code> 계정을 사용할 수 있습니다.</p>
        <form className="stack" onSubmit={handleSubmit}>
          <label>
            이메일
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" />
          </label>
          <label>
            비밀번호
            <input
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {success ? <p className="form-success" role="status">{success}</p> : null}
          <button className="button primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? '처리 중...' : mode === 'login' ? '로그인' : '가입'}
          </button>
        </form>
        <button className="link-button" onClick={toggleMode} type="button">
          {mode === 'login' ? '계정이 없나요? 가입하기' : '이미 계정이 있나요? 로그인'}
        </button>
      </section>
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
