import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postBackendJson } from '../../../shared/api/backendClient'
import type { DocumentMeta } from '../../../shared/types/contracts'
import { workspaceKeys } from '../../workspace/queries/useWorkspacesQuery'

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
  const result = await postBackendJson<{ document: DocumentMeta }>(
    `/api/workspaces/${encodeURIComponent(input.workspaceId)}/documents`,
    { title: input.title }
  )
  return result.document
}
