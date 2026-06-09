import { useQuery } from '@tanstack/react-query'
import { getBackendJson } from '../../../shared/api/backendClient'
import type { AgentProfile } from '../../../shared/types/contracts'

export const agentKeys = {
  all: ['agents'] as const,
  list: (workspaceId: string) => [...agentKeys.all, workspaceId, 'list'] as const,
  tasks: (workspaceId: string) => [...agentKeys.all, workspaceId, 'tasks'] as const,
  task: (taskId: string) => [...agentKeys.all, 'task', taskId] as const
}

export function useAgentsQuery(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: workspaceId ? agentKeys.list(workspaceId) : ['agents', 'missing', 'list'],
    queryFn: () => listAgents(workspaceId!),
    enabled: Boolean(workspaceId),
    staleTime: 30_000
  })
}

export async function listAgents(workspaceId: string): Promise<AgentProfile[]> {
  const result = await getBackendJson<{ agents: AgentProfile[] }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/agents`
  )
  return result.agents
}
