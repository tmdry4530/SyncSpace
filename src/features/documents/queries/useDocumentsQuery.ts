import { useQuery } from '@tanstack/react-query'
import { requireSupabaseClient } from '../../../shared/api/supabaseClient'
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
  const supabase = requireSupabaseClient()
  const { data, error } = await supabase
    .from('documents')
    .select('id,workspace_id,title,created_by,updated_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapDocument)
}

export function mapDocument(row: Record<string, unknown>): DocumentMeta {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title),
    createdBy: String(row.created_by),
    updatedAt: String(row.updated_at)
  }
}
