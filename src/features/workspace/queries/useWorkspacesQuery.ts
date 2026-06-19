import { useQuery } from '@tanstack/react-query'
import { getBackendJson } from '../../../shared/api/backendClient'
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
  const result = await getBackendJson<{ workspaces: Workspace[] }>('/api/workspaces')
  return result.workspaces
}
