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
  const setParticipantId = useAuthStore((state) => state.setParticipantId)
  const setLoading = useAuthStore((state) => state.setLoading)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchMe()
      .then((session) => {
        if (!alive) return
        setUser(session.user)
        setParticipantId(session.participantId)
      })
      .catch(() => {
        if (!alive) return
        setUser(null)
        setParticipantId(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [setLoading, setUser, setParticipantId])

  return <>{children}</>
}
