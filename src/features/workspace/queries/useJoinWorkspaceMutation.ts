import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postBackendJson } from '../../../shared/api/backendClient'
import type { Workspace } from '../../../shared/types/contracts'
import { workspaceKeys } from './useWorkspacesQuery'

export function useJoinWorkspaceMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: joinWorkspace,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() })
    }
  })
}

export async function joinWorkspace(inviteCode: string): Promise<{ workspace: Workspace }> {
  return postBackendJson<{ workspace: Workspace }>('/api/workspaces/join', { inviteCode })
}
