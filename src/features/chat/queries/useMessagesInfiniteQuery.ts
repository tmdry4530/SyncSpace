import { useInfiniteQuery } from '@tanstack/react-query'
import { requireSupabaseClient } from '../../../shared/api/supabaseClient'
import type { ChatMessage, PaginatedChatMessages, UserProfile } from '../../../shared/types/contracts'
import { realtimePolling } from '../../realtime/queryPolling'

export const messageKeys = {
  all: ['messages'] as const,
  channel: (channelId: string) => [...messageKeys.all, channelId] as const
}

export function useMessagesInfiniteQuery(channelId: string | null | undefined, limit = 30) {
  return useInfiniteQuery({
    queryKey: channelId ? messageKeys.channel(channelId) : ['messages', 'missing'],
    queryFn: ({ pageParam }) => listMessages({ channelId: channelId!, cursor: pageParam, limit }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(channelId),
    staleTime: 1_000,
    ...realtimePolling
  })
}

async function listMessages(input: { channelId: string; cursor?: string | null; limit: number }): Promise<PaginatedChatMessages> {
  const supabase = requireSupabaseClient()
  let query = supabase
    .from('messages')
    .select(
      `id,channel_id,user_id,content,client_id,created_at,user:profiles!messages_user_id_fkey(id,display_name,avatar_url,color)`
    )
    .eq('channel_id', input.channelId)
    .order('created_at', { ascending: false })
    .limit(input.limit + 1)

  if (input.cursor) query = query.lt('created_at', input.cursor)

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  const items = rows.slice(0, input.limit).map(mapMessage)
  return {
    items,
    nextCursor: rows.length > input.limit ? items.at(-1)?.createdAt ?? null : null
  }
}

export function mapMessage(row: Record<string, unknown>): ChatMessage {
  const clientId = row.client_id ? String(row.client_id) : undefined
  const user = mapUser(row.user)
  return {
    id: String(row.id),
    channelId: String(row.channel_id),
    userId: String(row.user_id),
    content: String(row.content),
    createdAt: String(row.created_at),
    ...(clientId ? { clientId } : {}),
    status: 'sent',
    ...(user ? { user } : {})
  }
}

function mapUser(value: unknown): UserProfile | undefined {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return undefined
  const record = row as Record<string, unknown>
  return {
    id: String(record.id),
    displayName: String(record.display_name),
    avatarUrl: record.avatar_url ? String(record.avatar_url) : null,
    color: String(record.color ?? '#64748b')
  }
}
