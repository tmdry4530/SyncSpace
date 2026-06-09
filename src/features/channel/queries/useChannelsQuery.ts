import { useQuery } from '@tanstack/react-query'
import { getBackendJson } from '../../../shared/api/backendClient'
import type { Channel } from '../../../shared/types/contracts'
import { realtimePolling } from '../../realtime/queryPolling'
import { workspaceKeys } from '../../workspace/queries/useWorkspacesQuery'

export function useChannelsQuery(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: workspaceId ? workspaceKeys.channels(workspaceId) : ['workspaces', 'missing', 'channels'],
    queryFn: () => listChannels(workspaceId!),
    enabled: Boolean(workspaceId),
    staleTime: 1_000,
    ...realtimePolling
  })
}

export async function listChannels(workspaceId: string): Promise<Channel[]> {
  const result = await getBackendJson<{ channels: Channel[] }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/channels`
  )
  return result.channels
}
