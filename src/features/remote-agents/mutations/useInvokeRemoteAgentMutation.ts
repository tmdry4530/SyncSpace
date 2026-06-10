import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invokeRemoteAgent, type InvokeRemoteAgentInput } from '../../../shared/api/remoteAgentApi'
import type { A2aTask } from '../../../shared/types/contracts'
import { agentKeys } from '../../agents/queries/useAgentsQuery'

export function useInvokeRemoteAgentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation<A2aTask, Error, InvokeRemoteAgentInput>({
    mutationFn: invokeRemoteAgent,
    onSuccess: () => {
      if (!workspaceId) return
      void queryClient.invalidateQueries({ queryKey: agentKeys.tasks(workspaceId) })
    }
  })
}
