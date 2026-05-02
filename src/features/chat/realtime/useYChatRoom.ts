import { useEffect, useMemo, useState } from 'react'
import * as Y from 'yjs'
import { useConnectionStatus } from '../../realtime/useConnectionStatus'
import { useYAwareness } from '../../realtime/useYAwareness'
import { useYDoc } from '../../realtime/useYDoc'
import { useYProvider } from '../../realtime/useYProvider'
import { useAuthStore } from '../../../shared/stores/authStore'
import type { ChatMessage, PresenceUser } from '../../../shared/types/contracts'
import { getChatRoomName, getChatWsUrl } from '../../../shared/utils/roomNames'

const MESSAGE_ARRAY = 'messages'

export function useYChatRoom(workspaceId: string, channelId: string) {
  const profile = useAuthStore((state) => state.profile)
  const user = useMemo<PresenceUser | null>(() => profile, [profile])
  const roomName = useMemo(() => getChatRoomName(workspaceId, channelId), [channelId, workspaceId])
  const wsUrl = useMemo(() => getChatWsUrl(workspaceId, channelId), [channelId, workspaceId])
  const doc = useYDoc(roomName)
  const provider = useYProvider(wsUrl, roomName, doc)
  const status = useConnectionStatus(provider)
  const presence = useYAwareness(provider, user, 'chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    if (!doc) return
    const yMessages = doc.getArray<ChatMessage>(MESSAGE_ARRAY)
    const sync = () => setMessages(yMessages.toArray())
    yMessages.observe(sync)
    sync()
    return () => yMessages.unobserve(sync)
  }, [doc])

  function sendMessage(input: { content: string; userId: string }) {
    const yMessages = doc?.getArray<ChatMessage>(MESSAGE_ARRAY)
    if (!yMessages) return
    const now = new Date().toISOString()
    const clientId = crypto.randomUUID()
    yMessages.push([
      {
        id: crypto.randomUUID(),
        channelId,
        userId: input.userId,
        content: input.content,
        clientId,
        createdAt: now,
        status: status === 'idle' ? 'pending' : 'sent',
        ...(profile ? { user: profile } : {})
      }
    ])
  }

  return { roomName, provider, doc, status, presence, messages, sendMessage }
}
