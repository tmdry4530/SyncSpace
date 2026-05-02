import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServerConfig } from '../config.js'
import { hasSupabaseAdminConfig } from '../config.js'
import type { ChatMessage, PaginatedChatMessages, UserProfile } from '../types/contracts.js'
import type { Logger } from '../utils/logger.js'
import { createSupabaseAdminClient } from './supabaseAdmin.js'

export interface MessagePersistInput {
  id?: string
  channelId: string
  userId: string
  content: string
  clientId?: string | null
  createdAt?: string
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

interface SupabaseErrorLike {
  code?: string
  message?: string
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

export class SupabaseMessagePersistenceAdapter implements MessagePersistenceAdapter {
  constructor(private readonly client: SupabaseClient) {}

  async persistMessage(input: MessagePersistInput): Promise<ChatMessage> {
    const row = toMessageRow(input)
    const insert = await this.client
      .from('messages')
      .insert(row)
      .select(messageSelectColumns)
      .single()

    if (!insert.error && insert.data) return mapMessageRow(insert.data)

    if (isDuplicateError(insert.error) && input.clientId) {
      const existing = await this.client
        .from('messages')
        .select(messageSelectColumns)
        .eq('channel_id', input.channelId)
        .eq('client_id', input.clientId)
        .single()

      if (!existing.error && existing.data) return mapMessageRow(existing.data)
    }

    throw new Error(`Failed to persist chat message: ${insert.error?.message ?? 'unknown Supabase error'}`)
  }

  async listMessages(input: ListMessagesInput): Promise<PaginatedChatMessages> {
    const limit = clampLimit(input.limit)
    let query = this.client
      .from('messages')
      .select(messageSelectColumns)
      .eq('channel_id', input.channelId)
      .order('created_at', { ascending: false })
      .limit(limit + 1)

    if (input.cursor) {
      query = query.lt('created_at', input.cursor)
    }

    const result = await query
    if (result.error) {
      throw new Error(`Failed to list chat messages: ${result.error.message ?? 'unknown Supabase error'}`)
    }

    const rows = Array.isArray(result.data) ? result.data : []
    const pageRows = rows.slice(0, limit)
    return {
      items: pageRows.map(mapMessageRow),
      nextCursor: rows.length > limit ? (pageRows.at(-1) ? mapMessageRow(pageRows.at(-1)).createdAt : null) : null
    }
  }
}

export function createMessagePersistenceAdapter(config: ServerConfig, logger: Logger): MessagePersistenceAdapter {
  if (!hasSupabaseAdminConfig(config)) {
    logger.warn('Supabase service-role configuration is missing; chat messages will use in-memory noop persistence')
    return new NoopMessagePersistenceAdapter()
  }

  return new SupabaseMessagePersistenceAdapter(createSupabaseAdminClient(config))
}

const messageSelectColumns = `
  id,
  channel_id,
  user_id,
  content,
  client_id,
  created_at,
  user:profiles!messages_user_id_fkey (
    id,
    display_name,
    avatar_url,
    color
  )
`

function toChatMessage(input: MessagePersistInput): ChatMessage {
  const clientId = input.clientId ?? undefined
  return {
    id: input.id ?? randomUUID(),
    channelId: input.channelId,
    userId: input.userId,
    content: input.content,
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...(clientId ? { clientId } : {}),
    status: 'sent'
  }
}

function toMessageRow(input: MessagePersistInput): Record<string, string | null> {
  return {
    id: input.id ?? randomUUID(),
    channel_id: input.channelId,
    user_id: input.userId,
    content: input.content,
    client_id: input.clientId ?? null,
    created_at: input.createdAt ?? new Date().toISOString()
  }
}

function mapMessageRow(row: any): ChatMessage {
  const user = mapUser(row.user)
  const clientId = row.client_id ?? undefined
  return {
    id: String(row.id),
    channelId: String(row.channel_id),
    userId: String(row.user_id),
    content: String(row.content),
    createdAt: String(row.created_at),
    ...(clientId ? { clientId: String(clientId) } : {}),
    status: 'sent',
    ...(user ? { user } : {})
  }
}

function mapUser(value: unknown): UserProfile | undefined {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return undefined
  const record = row as Record<string, unknown>
  if (!record.id || !record.display_name || !record.color) return undefined
  return {
    id: String(record.id),
    displayName: String(record.display_name),
    avatarUrl: record.avatar_url ? String(record.avatar_url) : null,
    color: String(record.color)
  }
}

function clampLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit <= 0) return 50
  return Math.min(limit, 100)
}

function isDuplicateError(error: SupabaseErrorLike | null | undefined): boolean {
  return error?.code === '23505'
}
