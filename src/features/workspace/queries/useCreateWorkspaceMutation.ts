import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import { ensureUserProfile } from '../../../shared/api/profiles'
import { requireSupabaseClient } from '../../../shared/api/supabaseClient'
import { useAuthStore } from '../../../shared/stores/authStore'
import type { Workspace } from '../../../shared/types/contracts'
import { mapWorkspace, workspaceKeys } from './useWorkspacesQuery'

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)

  return useMutation({
    mutationFn: async (input: { name: string }) => createWorkspace(input, user ?? null),
    onSuccess: (workspace) => {
      queryClient.setQueryData<Workspace[]>(workspaceKeys.lists(), (current = []) => {
        if (current.some((item) => item.id === workspace.id)) return current
        return [...current, workspace].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      })
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
    }
  })
}

async function createWorkspace(input: { name: string }, user: User | null): Promise<Workspace> {
  if (!user) throw new Error('로그인이 필요합니다.')

  await ensureUserProfile(user)

  const supabase = requireSupabaseClient()
  const { error: insertError } = await supabase.from('workspaces').insert({ name: input.name, owner_id: user.id })
  if (insertError) throw insertError

  const { data, error } = await supabase
    .from('workspaces')
    .select('id,name,owner_id,invite_code,created_at')
    .eq('owner_id', user.id)
    .eq('name', input.name)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('워크스페이스를 만들었지만 목록에서 확인하지 못했습니다. 잠시 후 새로고침하세요.')
  return mapWorkspace(data)
}
