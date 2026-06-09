import { useEffect, type PropsWithChildren } from 'react'
import { fetchMe } from '../../shared/api/authApi'
import { useAuthStore } from '../../shared/stores/authStore'
import { useWorkspacesRealtime } from '../../features/realtime/useServerStateRealtime'
import { QueryProvider } from './QueryProvider'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <AuthBootstrap>
        <ServerRealtimeBridge />
        {children}
      </AuthBootstrap>
    </QueryProvider>
  )
}

function ServerRealtimeBridge() {
  useWorkspacesRealtime()
  return null
}

function AuthBootstrap({ children }: PropsWithChildren) {
  const setUser = useAuthStore((state) => state.setUser)
  const setLoading = useAuthStore((state) => state.setLoading)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchMe()
      .then((user) => {
        if (alive) setUser(user)
      })
      .catch(() => {
        if (alive) setUser(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [setLoading, setUser])

  return <>{children}</>
}
