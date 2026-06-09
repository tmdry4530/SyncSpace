import { FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { routes } from '../../app/router/routes'
import { login, register } from '../../shared/api/authApi'
import { toAppError } from '../../shared/api/errors'
import { useAuthStore } from '../../shared/stores/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? routes.workspaces

  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [from, navigate, user])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const account =
        mode === 'login'
          ? await login({ email, password })
          : await register({ email, password, displayName: email.split('@')[0] ?? email })
      setUser(account)
      navigate(from, { replace: true })
    } catch (caught) {
      setError(getAuthErrorMessage(toAppError(caught).message))
    } finally {
      setSubmitting(false)
    }
  }

  function toggleMode() {
    setMode(mode === 'login' ? 'signup' : 'login')
    setError(null)
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand-mark" to={routes.home}>SyncSpace</Link>
        <h1>{mode === 'login' ? '다시 입장하기' : '새 계정 만들기'}</h1>
        <p className="auth-copy">제공받은 계정으로 로그인하거나 새 계정을 만들 수 있습니다.</p>
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
  if (normalized.includes('invalid') && normalized.includes('credential')) return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (normalized.includes('already')) return '이미 가입된 이메일입니다. 로그인으로 다시 시도하세요.'
  return message
}
