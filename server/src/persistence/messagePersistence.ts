import { randomUUID } from 'node:crypto'
import type { ServerConfig } from '../config.js'
import { hasDatabaseConfig } from '../config.js'
import type { ChatMessage, PaginatedChatMessages, ParticipantType } from '../types/contracts.js'
import type { Logger } from '../utils/logger.js'
import { createPostgresMessagePersistenceAdapter } from './messagePersistencePg.js'

export interface MessagePersistInput {
  id?: string
  channelId: string
  userId?: string | null
  content: string
  clientId?: string | null
  createdAt?: string
  authorParticipantId?: string | null
  authorType?: ParticipantType
  agentId?: string | null
  a2aMessageId?: string | null
  metadata?: Record<string, unknown>
}

export interface ListMessagesInput {
  channelId: string
  cursor?: string | null
  limit: number
}

export interface MessagePersistenceAdapter {
  persistMessage(input: MessagePersistInput): Promise<ChatMessage>
  listMessages(input: ListMessagesInput): Promise<PaginatedChatMessages>
}

export class NoopMessagePersistenceAdapter implements MessagePersistenceAdapter {
  readonly messages: ChatMessage[] = []

  async persistMessage(input: MessagePersistInput): Promise<ChatMessage> {
    const message = toChatMessage(input)
    const existing = this.messages.find((item) => item.id === message.id || (message.clientId && item.clientId === message.clientId))
    if (existing) return existing
    this.messages.push(message)
    return message
  }

  async listMessages(input: ListMessagesInput): Promise<PaginatedChatMessages> {
    const limit = clampLimit(input.limit)
    const channelMessages = this.messages
      .filter((message) => message.channelId === input.channelId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

    const filtered = input.cursor
      ? channelMessages.filter((message) => message.createdAt < input.cursor!)
      : channelMessages

    const page = filtered.slice(0, limit)
    return {
      items: page,
      nextCursor: filtered.length > limit ? page.at(-1)?.createdAt ?? null : null
    }
  }
}

export function createMessagePersistenceAdapter(config: ServerConfig, logger: Logger): MessagePersistenceAdapter {
  if (hasDatabaseConfig(config)) {
    return createPostgresMessagePersistenceAdapter()
  }
  logger.warn('No DATABASE_URL configured; chat messages will use in-memory noop persistence')
  return new NoopMessagePersistenceAdapter()
}

function toChatMessage(input: MessagePersistInput): ChatMessage {
  const clientId = input.clientId ?? undefined
  return {
    id: input.id ?? randomUUID(),
    channelId: input.channelId,
    userId: input.userId ?? input.authorParticipantId ?? '',
    content: input.content,
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...(clientId ? { clientId } : {}),
    status: 'sent'
  }
}

function clampLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit <= 0) return 50
  return Math.min(limit, 100)
}
