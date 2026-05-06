import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteBackendJson } from '../../../shared/api/backendClient'
import type { Workspace } from '../../../shared/types/contracts'
import { workspaceKeys } from './useWorkspacesQuery'

export function useDeleteWorkspaceMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteWorkspace,
    onSuccess: (workspaceId) => {
      queryClient.setQueryData<Workspace[]>(workspaceKeys.lists(), (current = []) =>
        current.filter((workspace) => workspace.id !== workspaceId)
      )
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
    }
  })
}

async function deleteWorkspace(input: { workspaceId: string }): Promise<string> {
  const result = await deleteBackendJson<{ workspaceId: string }>(`/api/workspaces/${encodeURIComponent(input.workspaceId)}`)
  return result.workspaceId
}
