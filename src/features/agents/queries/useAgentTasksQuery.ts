import { useQuery } from '@tanstack/react-query'
import { getBackendJson } from '../../../shared/api/backendClient'
import type { A2aTask } from '../../../shared/types/contracts'
import { realtimePolling } from '../../realtime/queryPolling'
import { agentKeys } from './useAgentsQuery'

export function useAgentTasksQuery(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: workspaceId ? agentKeys.tasks(workspaceId) : ['agents', 'missing', 'tasks'],
    queryFn: () => listAgentTasks(workspaceId!),
    enabled: Boolean(workspaceId),
    staleTime: 1_000,
    ...realtimePolling
  })
}

export async function listAgentTasks(workspaceId: string): Promise<A2aTask[]> {
  const result = await getBackendJson<{ tasks: A2aTask[]; nextPageToken?: string }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/tasks`
  )
  return result.tasks
}
