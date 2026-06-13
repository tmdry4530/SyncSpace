import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postBackendJson } from '../../../shared/api/backendClient'
import { workspaceKeys } from './useWorkspacesQuery'

export function useRotateInviteCodeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rotateInviteCode,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() })
    }
  })
}

export async function rotateInviteCode(workspaceId: string): Promise<{ inviteCode: string }> {
  return postBackendJson<{ inviteCode: string }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/invite-code/rotate`
  )
}
