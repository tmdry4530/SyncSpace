import { useMutation, useQueryClient } from '@tanstack/react-query'
import { verifyRemoteAgent } from '../../../shared/api/remoteAgentApi'
import type { RemoteVerificationStatus } from '../../../shared/types/contracts'
import { remoteAgentKeys } from '../queries/useRemoteAgentsQuery'

export function useVerifyRemoteAgentMutation() {
  const queryClient = useQueryClient()
  return useMutation<{ id: string; status: RemoteVerificationStatus }, Error, string>({
    mutationFn: (id: string) => verifyRemoteAgent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: remoteAgentKeys.list() })
    }
  })
}
