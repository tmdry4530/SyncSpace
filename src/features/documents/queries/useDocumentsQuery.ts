import { useQuery } from '@tanstack/react-query'
import { getBackendJson } from '../../../shared/api/backendClient'
import type { DocumentMeta } from '../../../shared/types/contracts'
import { realtimePolling } from '../../realtime/queryPolling'
import { workspaceKeys } from '../../workspace/queries/useWorkspacesQuery'

export function useDocumentsQuery(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: workspaceId ? workspaceKeys.documents(workspaceId) : ['workspaces', 'missing', 'documents'],
    queryFn: () => listDocuments(workspaceId!),
    enabled: Boolean(workspaceId),
    staleTime: 1_000,
    ...realtimePolling
  })
}

export async function listDocuments(workspaceId: string): Promise<DocumentMeta[]> {
  const result = await getBackendJson<{ documents: DocumentMeta[] }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/documents`
  )
  return result.documents
}
