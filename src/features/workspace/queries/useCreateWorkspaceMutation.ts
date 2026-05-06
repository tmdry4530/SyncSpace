import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postBackendJson } from '../../../shared/api/backendClient'
import type { Workspace } from '../../../shared/types/contracts'
import { mapWorkspace, workspaceKeys } from './useWorkspacesQuery'

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: (workspace) => {
      queryClient.setQueryData<Workspace[]>(workspaceKeys.lists(), (current = []) => {
        if (current.some((item) => item.id === workspace.id)) return current
        return [...current, workspace].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      })
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.channels(workspace.id) })
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.documents(workspace.id) })
    }
  })
}

async function createWorkspace(input: { name: string }): Promise<Workspace> {
  const result = await postBackendJson<{ workspace: Workspace }>('/api/workspaces', { name: input.name })
  return result.workspace
}
