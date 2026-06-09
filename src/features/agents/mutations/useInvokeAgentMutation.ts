import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postBackendJson } from '../../../shared/api/backendClient'
import type { A2aTask } from '../../../shared/types/contracts'
import { agentKeys } from '../queries/useAgentsQuery'

export interface InvokeAgentInput {
  agentId: string
  content: string
  channelId?: string
  documentId?: string
  contextId?: string
}

export function useInvokeAgentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: invokeAgent,
    onSuccess: () => {
      if (!workspaceId) return
      void queryClient.invalidateQueries({ queryKey: agentKeys.tasks(workspaceId) })
    }
  })
}

async function invokeAgent(input: InvokeAgentInput): Promise<A2aTask> {
  const { agentId, ...body } = input
  const result = await postBackendJson<{ task: A2aTask }>(`/api/agents/${encodeURIComponent(agentId)}/invoke`, {
    content: body.content,
    ...(body.channelId ? { channelId: body.channelId } : {}),
    ...(body.documentId ? { documentId: body.documentId } : {}),
    ...(body.contextId ? { contextId: body.contextId } : {})
  })
  return result.task
}
