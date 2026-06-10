import { useMutation, useQueryClient } from '@tanstack/react-query'
import { registerRemoteAgent } from '../../../shared/api/remoteAgentApi'
import type { RemoteAgentRegistrationResult } from '../../../shared/types/contracts'
import { remoteAgentKeys } from '../queries/useRemoteAgentsQuery'

export function useRegisterRemoteAgentMutation() {
  const queryClient = useQueryClient()
  return useMutation<RemoteAgentRegistrationResult, Error, string>({
    mutationFn: (agentCardUrl: string) => registerRemoteAgent(agentCardUrl),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: remoteAgentKeys.list() })
    }
  })
}
