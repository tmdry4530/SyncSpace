import { useQuery } from '@tanstack/react-query'
import { requireSupabaseClient } from '../../../shared/api/supabaseClient'
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
  const supabase = requireSupabaseClient()
  const { data, error } = await supabase
    .from('channels')
    .select('id,workspace_id,name,created_by,created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapChannel)
}

export function mapChannel(row: Record<string, unknown>): Channel {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at)
  }
}
