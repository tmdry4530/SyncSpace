import { useMutation, useQueryClient } from '@tanstack/react-query'
import { requireSupabaseClient } from '../../../shared/api/supabaseClient'
import { useAuthStore } from '../../../shared/stores/authStore'
import type { Workspace } from '../../../shared/types/contracts'
import { workspaceKeys } from './useWorkspacesQuery'

export function useDeleteWorkspaceMutation() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: (input: { workspaceId: string }) => deleteWorkspace(input, userId ?? null),
    onSuccess: (workspaceId) => {
      queryClient.setQueryData<Workspace[]>(workspaceKeys.lists(), (current = []) =>
        current.filter((workspace) => workspace.id !== workspaceId)
      )
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
    }
  })
}

async function deleteWorkspace(input: { workspaceId: string }, userId: string | null): Promise<string> {
  if (!userId) throw new Error('로그인이 필요합니다.')

  const supabase = requireSupabaseClient()
  const { data, error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', input.workspaceId)
    .eq('owner_id', userId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('소유자만 워크스페이스를 삭제할 수 있습니다.')
  return String(data.id)
}
