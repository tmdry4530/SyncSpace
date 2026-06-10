import { useQuery } from '@tanstack/react-query'
import { listRemoteAgents } from '../../../shared/api/remoteAgentApi'
import type { RemoteAgentProfile } from '../../../shared/types/contracts'

export const remoteAgentKeys = {
  all: ['remote-agents'] as const,
  list: () => [...remoteAgentKeys.all, 'list'] as const
}

export function useRemoteAgentsQuery(enabled = true) {
  return useQuery<RemoteAgentProfile[]>({
    queryKey: remoteAgentKeys.list(),
    queryFn: listRemoteAgents,
    enabled,
    staleTime: 30_000
  })
}
