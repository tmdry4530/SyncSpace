import { useInfiniteQuery } from '@tanstack/react-query'
import { getBackendJson } from '../../../shared/api/backendClient'
import type { PaginatedChatMessages } from '../../../shared/types/contracts'
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

async function listMessages(input: {
  channelId: string
  cursor?: string | null
  limit: number
}): Promise<PaginatedChatMessages> {
  const params = new URLSearchParams({ limit: String(input.limit) })
  if (input.cursor) params.set('cursor', input.cursor)
  return getBackendJson<PaginatedChatMessages>(
    `/api/channels/${encodeURIComponent(input.channelId)}/messages?${params.toString()}`
  )
}
