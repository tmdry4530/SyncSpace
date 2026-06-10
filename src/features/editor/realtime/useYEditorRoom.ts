import { useMemo } from 'react'
import { useConnectionStatus } from '../../realtime/useConnectionStatus'
import { useYAwareness } from '../../realtime/useYAwareness'
import { useYDoc } from '../../realtime/useYDoc'
import { useYProvider } from '../../realtime/useYProvider'
import { useAuthStore } from '../../../shared/stores/authStore'
import { agentIdentityToPresenceUser } from '../../../shared/api/profiles'
import type { PresenceUser } from '../../../shared/types/contracts'
import { getDocRoomName, getDocWsUrl } from '../../../shared/utils/roomNames'

export function useYEditorRoom(workspaceId: string, documentId: string) {
  const identity = useAuthStore((state) => state.identity)
  const user = useMemo<PresenceUser | null>(
    () => (identity ? agentIdentityToPresenceUser(identity) : null),
    [identity]
  )
  const roomName = useMemo(() => getDocRoomName(workspaceId, documentId), [documentId, workspaceId])
  const wsUrl = useMemo(() => getDocWsUrl(workspaceId, documentId), [documentId, workspaceId])
  const doc = useYDoc(roomName)
  const provider = useYProvider(wsUrl, roomName, doc)
  const status = useConnectionStatus(provider)
  const presence = useYAwareness(provider, user, 'document')

  return { roomName, provider, doc, status, presence }
}
