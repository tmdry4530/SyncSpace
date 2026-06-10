import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteRemoteAgent } from '../../../shared/api/remoteAgentApi'
import { remoteAgentKeys } from '../queries/useRemoteAgentsQuery'

export function useDeleteRemoteAgentMutation() {
  const queryClient = useQueryClient()
  return useMutation<{ id: string }, Error, string>({
    mutationFn: (id: string) => deleteRemoteAgent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: remoteAgentKeys.list() })
    }
  })
}
