import { useMutation, useQueryClient } from '@tanstack/react-query'
import { healthCheckRemoteAgent } from '../../../shared/api/remoteAgentApi'
import type { RemoteHealthStatus } from '../../../shared/types/contracts'
import { remoteAgentKeys } from '../queries/useRemoteAgentsQuery'

export function useHealthCheckMutation() {
  const queryClient = useQueryClient()
  return useMutation<{ id: string; healthStatus: RemoteHealthStatus }, Error, string>({
    mutationFn: (id: string) => healthCheckRemoteAgent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: remoteAgentKeys.list() })
    }
  })
}
