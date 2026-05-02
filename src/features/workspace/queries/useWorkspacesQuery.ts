import { useQuery } from '@tanstack/react-query'
import { requireSupabaseClient } from '../../../shared/api/supabaseClient'
import type { Workspace } from '../../../shared/types/contracts'
import { realtimePolling } from '../../realtime/queryPolling'

export const workspaceKeys = {
  all: ['workspaces'] as const,
  lists: () => [...workspaceKeys.all, 'list'] as const,
  channels: (workspaceId: string) => [...workspaceKeys.all, workspaceId, 'channels'] as const,
  documents: (workspaceId: string) => [...workspaceKeys.all, workspaceId, 'documents'] as const
}

export function useWorkspacesQuery() {
  return useQuery({
    queryKey: workspaceKeys.lists(),
    queryFn: listMyWorkspaces,
    staleTime: 1_000,
    ...realtimePolling
  })
}

export async function listMyWorkspaces(): Promise<Workspace[]> {
  const supabase = requireSupabaseClient()
  const { data, error } = await supabase
    .from('workspaces')
    .select('id,name,owner_id,invite_code,created_at')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapWorkspace)
}

export function mapWorkspace(row: Record<string, unknown>): Workspace {
  return {
    id: String(row.id),
    name: String(row.name),
    ownerId: String(row.owner_id),
    inviteCode: String(row.invite_code),
    createdAt: String(row.created_at)
  }
}
