import type * as Y from 'yjs'
import type { RealtimeConnectionIdentity } from '../auth/realtimeAuth.js'
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
  /**
   * Bind the authenticated upgrade identity to a WebSocket connection. Yjs
   * updates received from that connection are applied with the connection as
   * transaction origin, which is how inserted messages get attributed.
   */
  registerConnection(conn: object, identity: RealtimeConnectionIdentity): void
}

export interface ChatPersistenceOptions {
  debounceMs?: number
  /**
   * When true (default), a chat message is only persisted if its Yjs insert
   * originated from a registered authenticated connection, and authorship
   * (authorParticipantId / authorType / agentId) is taken from that identity.
   * Client-claimed authorship fields and metadata in the Yjs record are never
   * trusted. Disable only when realtime auth is off (dev mode).
   */
  enforceAuthorship?: boolean
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
  const authorParticipantId = typeof record.authorParticipantId === 'string' ? record.authorParticipantId : null
  const content = typeof record.content === 'string' ? record.content : null
  // A persistable message needs content and an author (legacy user or participant).
  if (!content || (!userId && !authorParticipantId)) return null

  const authorType = record.authorType === 'agent' ? 'agent' : 'human'
  const metadata =
    record.metadata && typeof record.metadata === 'object' ? (record.metadata as Record<string, unknown>) : undefined

  return {
    ...(typeof record.id === 'string' ? { id: record.id } : {}),
    // The channel is derived from the room the message arrived in; a record
    // cannot inject itself into a different channel.
    channelId,
    ...(userId ? { userId } : {}),
    ...(authorParticipantId ? { authorParticipantId } : {}),
    authorType,
    ...(typeof record.agentId === 'string' ? { agentId: record.agentId } : {}),
    content,
    ...(typeof record.clientId === 'string' ? { clientId: record.clientId } : {}),
    ...(typeof record.createdAt === 'string' ? { createdAt: record.createdAt } : {}),
    ...(metadata ? { metadata } : {})
  }
}

export function createChatRoomPersistenceHooks(
  adapter: MessagePersistenceAdapter,
  logger: Logger,
  options: ChatPersistenceOptions = {}
): ChatPersistenceHooks {
  const debounceMs = options.debounceMs ?? 250
  const enforceAuthorship = options.enforceAuthorship ?? true
  const seenByRoom = new Map<string, Set<string>>()
  const timers = new Map<string, NodeJS.Timeout>()
  const identities = new WeakMap<object, RealtimeConnectionIdentity>()
  const attributionsByRoom = new Map<string, Map<string, RealtimeConnectionIdentity>>()

  function registerConnection(conn: object, identity: RealtimeConnectionIdentity): void {
    identities.set(conn, identity)
  }

  function getAttributions(roomName: string): Map<string, RealtimeConnectionIdentity> {
    const existing = attributionsByRoom.get(roomName)
    if (existing) return existing
    const created = new Map<string, RealtimeConnectionIdentity>()
    attributionsByRoom.set(roomName, created)
    return created
  }

  async function flush(roomName: string, ydoc: Y.Doc): Promise<void> {
    const room = parseChatRoomName(roomName)
    if (!room) return

    const seen = getSeenSet(seenByRoom, roomName)
    const attributions = getAttributions(roomName)
    const messages = collectPersistableMessages(ydoc, room.channelId)
    for (const message of messages) {
      const key = messageKey(message)
      if (key && seen.has(key)) continue

      let input = message
      if (enforceAuthorship) {
        const identity = key ? attributions.get(key) : undefined
        if (!identity) {
          logger.warn('Dropping chat message without an authenticated origin', {
            roomName,
            messageId: message.id
          })
          continue
        }
        if (message.authorParticipantId && message.authorParticipantId !== identity.participantId) {
          logger.warn('Chat message claimed another author; persisting with connection identity', {
            roomName,
            messageId: message.id,
            claimedParticipantId: message.authorParticipantId,
            participantId: identity.participantId
          })
        }
        // Authorship comes from the authenticated connection; client-supplied
        // authorParticipantId/authorType/agentId/userId/metadata are discarded.
        input = {
          ...(message.id ? { id: message.id } : {}),
          channelId: message.channelId,
          content: message.content,
          ...(message.clientId ? { clientId: message.clientId } : {}),
          ...(message.createdAt ? { createdAt: message.createdAt } : {}),
          authorParticipantId: identity.participantId,
          authorType: identity.authorType,
          ...(identity.agentId ? { agentId: identity.agentId } : {})
        }
      }

      try {
        const persisted = await adapter.persistMessage(input)
        seen.add(messageKey(persisted) ?? key ?? persisted.id)
        if (key) attributions.delete(key)
      } catch (error) {
        logger.warn('Failed to persist chat Yjs message', {
          roomName,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }

  function bind(roomName: string, ydoc: Y.Doc): void {
    const room = parseChatRoomName(roomName)
    if (!room) return

    if (enforceAuthorship) {
      const attributions = getAttributions(roomName)
      ydoc.getArray<unknown>(CHAT_MESSAGES_ARRAY).observe((event) => {
        const origin: unknown = event.transaction.origin
        const identity = origin && typeof origin === 'object' ? identities.get(origin) : undefined
        if (!identity) return
        for (const op of event.changes.delta) {
          if (!Array.isArray(op.insert)) continue
          for (const value of op.insert) {
            const key = rawMessageKey(value, room.channelId)
            if (key) attributions.set(key, identity)
          }
        }
      })
    }

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

  return { bind, flush, registerConnection }
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

/** Attribution key for a raw Yjs record; must mirror messageKey() after normalization. */
function rawMessageKey(value: unknown, channelId: string): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id === 'string' && record.id) return `id:${record.id}`
  if (typeof record.clientId === 'string' && record.clientId) return `client:${channelId}:${record.clientId}`
  return null
}
