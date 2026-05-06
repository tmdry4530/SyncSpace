import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getAuthenticatedUser } from '../../../shared/api/auth'
import { requireSupabaseClient } from '../../../shared/api/supabaseClient'
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
  const supabase = requireSupabaseClient()
  const user = await getAuthenticatedUser(supabase)
  const { data, error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', input.workspaceId)
    .eq('owner_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('소유자만 워크스페이스를 삭제할 수 있습니다.')
  return String(data.id)
}
