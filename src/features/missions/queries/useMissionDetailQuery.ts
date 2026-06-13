import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBackendJson } from '../../../shared/api/backendClient'
import { realtimePolling } from '../../realtime/queryPolling'
import type { MissionDetailResponse, MissionEvent } from '../../../shared/types/missions'

export const missionKeys = {
  all: ['missions'] as const,
  detail: (contextId: string) => [...missionKeys.all, 'detail', contextId] as const,
  list: (workspaceId: string) => [...missionKeys.all, 'list', workspaceId] as const
}

/** Highest seq in a list of events (bigint-safe), or null when empty. */
function maxSeq(events: readonly MissionEvent[]): bigint | null {
  let max: bigint | null = null
  for (const ev of events) {
    const seq = BigInt(ev.seq)
    if (max === null || seq > max) max = seq
  }
  return max
}

/**
 * Merge a delta of new events into the cached mission, deduped by seq and kept
 * in seq-ascending order. Returns `cached` unchanged (same identity) when the
 * delta contains nothing new, so downstream memoization stays stable.
 */
function mergeEvents(cached: MissionDetailResponse, delta: readonly MissionEvent[]): MissionDetailResponse {
  if (delta.length === 0) return cached

  const bySeq = new Map<string, MissionEvent>()
  for (const ev of cached.events) bySeq.set(ev.seq, ev)
  let added = false
  for (const ev of delta) {
    if (!bySeq.has(ev.seq)) added = true
    bySeq.set(ev.seq, ev)
  }
  if (!added) return cached

  const merged = Array.from(bySeq.values()).sort((a, b) => {
    const sa = BigInt(a.seq)
    const sb = BigInt(b.seq)
    return sa < sb ? -1 : sa > sb ? 1 : 0
  })

  // Keep the freshest mission meta from the delta response (it always carries it),
  // but preserve the cached tasks/agents — the delta intentionally omits them.
  return { ...cached, events: merged }
}

export function useMissionDetailQuery(contextId: string | null | undefined) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: contextId ? missionKeys.detail(contextId) : ['missions', 'detail', 'missing'],
    queryFn: async () => {
      const id = contextId!
      const cached = queryClient.getQueryData<MissionDetailResponse>(missionKeys.detail(id))
      const since = cached ? maxSeq(cached.events) : null

      // First/empty load → full fetch (unchanged behavior). Otherwise fetch only
      // the events newer than what we already have and merge them in.
      if (!cached || since === null) {
        return getBackendJson<MissionDetailResponse>(`/api/missions/${encodeURIComponent(id)}`)
      }

      const delta = await getBackendJson<MissionDetailResponse>(
        `/api/missions/${encodeURIComponent(id)}?sinceSeq=${since.toString()}`
      )
      return mergeEvents(cached, delta.events)
    },
    enabled: Boolean(contextId),
    staleTime: 1_000,
    refetchInterval: realtimePolling.refetchInterval
  })
}
