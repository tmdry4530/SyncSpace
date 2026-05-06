import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getAuthenticatedUser } from '../../../shared/api/auth'
import { requireSupabaseClient } from '../../../shared/api/supabaseClient'
import type { DocumentMeta } from '../../../shared/types/contracts'
import { workspaceKeys } from '../../workspace/queries/useWorkspacesQuery'
import { mapDocument } from './useDocumentsQuery'

export function useCreateDocumentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { title: string }) => createDocument({ workspaceId: workspaceId!, title: input.title }),
    onSuccess: (document) => {
      if (!workspaceId) return
      queryClient.setQueryData<DocumentMeta[]>(workspaceKeys.documents(workspaceId), (current = []) => {
        if (current.some((item) => item.id === document.id)) return current
        return [...current, document].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      })
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.documents(workspaceId) })
    }
  })
}

async function createDocument(input: { workspaceId: string; title: string }): Promise<DocumentMeta> {
  const supabase = requireSupabaseClient()
  const user = await getAuthenticatedUser(supabase)
  const { error: insertError } = await supabase
    .from('documents')
    .insert({ workspace_id: input.workspaceId, title: input.title, created_by: user.id })

  if (insertError) throw insertError

  const { data, error } = await supabase
    .from('documents')
    .select('id,workspace_id,title,created_by,updated_at')
    .eq('workspace_id', input.workspaceId)
    .eq('title', input.title)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('문서를 만들었지만 목록에서 확인하지 못했습니다. 잠시 후 새로고침하세요.')
  return mapDocument(data)
}
