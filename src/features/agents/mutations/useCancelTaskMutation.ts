import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postBackendJson } from '../../../shared/api/backendClient'
import type { A2aTask } from '../../../shared/types/contracts'
import { agentKeys } from '../queries/useAgentsQuery'

export function useCancelTaskMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelTask,
    onSuccess: (task) => {
      void queryClient.invalidateQueries({ queryKey: agentKeys.task(task.id) })
      if (workspaceId) void queryClient.invalidateQueries({ queryKey: agentKeys.tasks(workspaceId) })
    }
  })
}

async function cancelTask(input: { taskId: string }): Promise<A2aTask> {
  const result = await postBackendJson<{ task: A2aTask }>(`/api/tasks/${encodeURIComponent(input.taskId)}/cancel`)
  return result.task
}
