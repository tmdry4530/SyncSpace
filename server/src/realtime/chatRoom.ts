import type * as Y from 'yjs'
import type { MessagePersistInput, MessagePersistenceAdapter } from '../persistence/messagePersistence.js'
import type { Logger } from '../utils/logger.js'
import { routeFromRoomName } from './roomNames.js'

export const CHAT_MESSAGES_ARRAY = 'messages'

export interface ChatRoomParts {
  workspaceId: string
  channelId: string
}

export interface ChatPersistenceHooks {
  bind(roomName: string, ydoc: Y.Doc): void
  flush(roomName: string, ydoc: Y.Doc): Promise<void>
}

export interface ChatPersistenceOptions {
  debounceMs?: number
}

export function isChatRoomName(roomName: string): boolean {
  return routeFromRoomName(roomName)?.kind === 'chat'
}

export function parseChatRoomName(roomName: string): ChatRoomParts | null {
  const route = routeFromRoomName(roomName)
  if (route?.kind !== 'chat') return null
  return {
    workspaceId: route.workspaceId,
    channelId: route.targetId
  }
}

export function collectPersistableMessages(ydoc: Y.Doc, channelId: string): MessagePersistInput[] {
  const messages = ydoc.getArray<unknown>(CHAT_MESSAGES_ARRAY).toArray()
  return messages.flatMap((message) => {
    const normalized = normalizeChatMessage(message, channelId)
    return normalized ? [normalized] : []
  })
}

export function normalizeChatMessage(value: unknown, channelId: string): MessagePersistInput | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const userId = typeof record.userId === 'string' ? record.userId : null
  const content = typeof record.content === 'string' ? record.content : null
  if (!userId || !content) return null

  return {
    ...(typeof record.id === 'string' ? { id: record.id } : {}),
    channelId: typeof record.channelId === 'string' ? record.channelId : channelId,
    userId,
    content,
    ...(typeof record.clientId === 'string' ? { clientId: record.clientId } : {}),
    ...(typeof record.createdAt === 'string' ? { createdAt: record.createdAt } : {})
  }
}

export function createChatRoomPersistenceHooks(
  adapter: MessagePersistenceAdapter,
  logger: Logger,
  options: ChatPersistenceOptions = {}
): ChatPersistenceHooks {
  const debounceMs = options.debounceMs ?? 250
  const seenByRoom = new Map<string, Set<string>>()
  const timers = new Map<string, NodeJS.Timeout>()

  async function flush(roomName: string, ydoc: Y.Doc): Promise<void> {
    const room = parseChatRoomName(roomName)
    if (!room) return

    const seen = getSeenSet(seenByRoom, roomName)
    const messages = collectPersistableMessages(ydoc, room.channelId)
    for (const message of messages) {
      const key = messageKey(message)
      if (key && seen.has(key)) continue

      try {
        const persisted = await adapter.persistMessage(message)
        seen.add(messageKey(persisted) ?? key ?? persisted.id)
      } catch (error) {
        logger.warn('Failed to persist chat Yjs message', {
          roomName,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }

  function bind(roomName: string, ydoc: Y.Doc): void {
    if (!isChatRoomName(roomName)) return
    const scheduleFlush = (): void => {
      const existing = timers.get(roomName)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => {
        timers.delete(roomName)
        void flush(roomName, ydoc)
      }, debounceMs)
      timers.set(roomName, timer)
    }

    ydoc.on('update', scheduleFlush)
    void flush(roomName, ydoc)
  }

  return { bind, flush }
}

function getSeenSet(map: Map<string, Set<string>>, roomName: string): Set<string> {
  const existing = map.get(roomName)
  if (existing) return existing
  const created = new Set<string>()
  map.set(roomName, created)
  return created
}

function messageKey(message: { id?: string; clientId?: string | null; channelId: string }): string | null {
  if (message.id) return `id:${message.id}`
  if (message.clientId) return `client:${message.channelId}:${message.clientId}`
  return null
}
