import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import { postBackendJson } from '../../../shared/api/backendClient'
import { ensureUserProfile } from '../../../shared/api/profiles'
import { useAuthStore } from '../../../shared/stores/authStore'
import type { Workspace } from '../../../shared/types/contracts'
import { workspaceKeys } from './useWorkspacesQuery'

export function useJoinWorkspaceMutation() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)

  return useMutation({
    mutationFn: async (input: { inviteCode: string }) => joinWorkspaceByInviteCode(input, user ?? null),
    onSuccess: (workspace) => {
      queryClient.setQueryData<Workspace[]>(workspaceKeys.lists(), (current = []) => {
        if (current.some((item) => item.id === workspace.id)) return current
        return [...current, workspace].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      })
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
    }
  })
}

async function joinWorkspaceByInviteCode(input: { inviteCode: string }, user: User | null): Promise<Workspace> {
  if (!user) throw new Error('로그인이 필요합니다.')
  await ensureUserProfile(user)

  const normalizedCode = input.inviteCode.trim().replace(/\s+/g, '').toUpperCase()
  if (!normalizedCode) throw new Error('초대 코드를 입력해주세요.')

  const result = await postBackendJson<{ workspace: Workspace }>('/api/workspaces/join', { inviteCode: normalizedCode })
  return result.workspace
}
