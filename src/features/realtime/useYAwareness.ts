import { useEffect, useMemo, useState } from 'react'
import type { WebsocketProvider } from 'y-websocket'
import type { AwarenessState, PresenceUser } from '../../shared/types/contracts'
import { usePresenceUiStore } from '../../shared/stores/presenceStore'

export function useYAwareness(provider: WebsocketProvider | null, user: PresenceUser | null, mode: AwarenessState['mode']) {
  const [states, setStates] = useState<AwarenessState[]>([])

  const localState = useMemo<AwarenessState | null>(() => {
    if (!user) return null
    return { user, mode, lastSeenAt: Date.now() }
  }, [mode, user])

  useEffect(() => {
    if (!provider) return

    if (localState) provider.awareness.setLocalState(localState)

    const collectStates = () => {
      const next = Array.from(provider.awareness.getStates().values())
        .filter(isAwarenessState)
        .sort((a, b) => a.user.displayName.localeCompare(b.user.displayName))
      setStates(next)
      usePresenceUiStore.getState().setStates(next)
    }

    provider.awareness.on('change', collectStates)
    collectStates()

    return () => {
      provider.awareness.off('change', collectStates)
      provider.awareness.setLocalState(null)
      usePresenceUiStore.getState().clear()
    }
  }, [localState, provider])

  return states
}

function isAwarenessState(value: unknown): value is AwarenessState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  const user = record.user as Record<string, unknown> | undefined
  return (
    !!user &&
    typeof user.id === 'string' &&
    typeof user.displayName === 'string' &&
    (record.mode === 'chat' || record.mode === 'document') &&
    typeof record.lastSeenAt === 'number'
  )
}
