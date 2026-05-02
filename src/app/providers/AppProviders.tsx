import { useEffect, type PropsWithChildren } from 'react'
import { getSupabaseClient } from '../../shared/api/supabaseClient'
import { ensureUserProfile } from '../../shared/api/profiles'
import type { UserProfile } from '../../shared/types/contracts'
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
  const setSession = useAuthStore((state) => state.setSession)
  const setProfile = useAuthStore((state) => state.setProfile)
  const setLoading = useAuthStore((state) => state.setLoading)
  const reset = useAuthStore((state) => state.reset)

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      reset()
      return
    }

    let alive = true

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!alive) return null
        setSession(data.session)
        return loadOrCreateProfile(data.session?.user ?? null)
      })
      .then((profile) => {
        if (!alive) return
        setProfile(profile ?? null)
      })
      .catch(() => {
        if (alive) setProfile(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
      if (!session?.user) {
        setProfile(null)
        return
      }
      void loadOrCreateProfile(session.user).then(setProfile).catch(() => setProfile(null))
    })

    return () => {
      alive = false
      subscription.subscription.unsubscribe()
    }
  }, [reset, setLoading, setProfile, setSession])

  return <>{children}</>
}

async function loadOrCreateProfile(user: Parameters<typeof ensureUserProfile>[0] | null): Promise<UserProfile | null> {
  if (!user) return null
  return ensureUserProfile(user)
}
