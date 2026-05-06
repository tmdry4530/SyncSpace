import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postBackendJson } from '../../../shared/api/backendClient'
import { getAuthenticatedUser } from '../../../shared/api/auth'
import { ensureUserProfile } from '../../../shared/api/profiles'
import { requireSupabaseClient } from '../../../shared/api/supabaseClient'
import type { Workspace } from '../../../shared/types/contracts'
import { workspaceKeys } from './useWorkspacesQuery'

export function useJoinWorkspaceMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: joinWorkspaceByInviteCode,
    onSuccess: (workspace) => {
      queryClient.setQueryData<Workspace[]>(workspaceKeys.lists(), (current = []) => {
        if (current.some((item) => item.id === workspace.id)) return current
        return [...current, workspace].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      })
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
    }
  })
}

async function joinWorkspaceByInviteCode(input: { inviteCode: string }): Promise<Workspace> {
  const supabase = requireSupabaseClient()
  const user = await getAuthenticatedUser(supabase)
  await ensureUserProfile(user)

  const normalizedCode = input.inviteCode.trim().replace(/\s+/g, '').toUpperCase()
  if (!normalizedCode) throw new Error('초대 코드를 입력해주세요.')

  const result = await postBackendJson<{ workspace: Workspace }>('/api/workspaces/join', { inviteCode: normalizedCode })
  return result.workspace
}
