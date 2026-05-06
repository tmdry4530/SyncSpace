import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import { ensureUserProfile } from '../../../shared/api/profiles'
import { requireSupabaseClient } from '../../../shared/api/supabaseClient'
import { useAuthStore } from '../../../shared/stores/authStore'
import type { Workspace } from '../../../shared/types/contracts'
import { mapWorkspace, workspaceKeys } from './useWorkspacesQuery'

const STARTER_CHANNEL_NAME = 'general'
const STARTER_DOCUMENT_TITLE = 'Welcome to SyncSpace'

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
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.channels(workspace.id) })
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.documents(workspace.id) })
    }
  })
}

async function createWorkspace(input: { name: string }, user: User | null): Promise<Workspace> {
  if (!user) throw new Error('로그인이 필요합니다.')

  await ensureUserProfile(user)

  const supabase = requireSupabaseClient()
  const { data, error } = await supabase
    .from('workspaces')
    .insert({ name: input.name, owner_id: user.id })
    .select('id,name,owner_id,invite_code,created_at')
    .single()

  if (error) throw error
  if (!data) throw new Error('워크스페이스를 만들었지만 목록에서 확인하지 못했습니다. 잠시 후 새로고침하세요.')

  const workspace = mapWorkspace(data)
  await createStarterCollaborationItems({ workspaceId: workspace.id, userId: user.id })

  return workspace
}

async function createStarterCollaborationItems(input: { workspaceId: string; userId: string }): Promise<void> {
  const supabase = requireSupabaseClient()

  const { error: channelError } = await supabase
    .from('channels')
    .insert({ workspace_id: input.workspaceId, name: STARTER_CHANNEL_NAME, created_by: input.userId })

  if (channelError) {
    throw new Error(`워크스페이스는 만들었지만 기본 채널을 만들지 못했습니다: ${channelError.message}`)
  }

  const { error: documentError } = await supabase
    .from('documents')
    .insert({ workspace_id: input.workspaceId, title: STARTER_DOCUMENT_TITLE, created_by: input.userId })

  if (documentError) {
    throw new Error(`워크스페이스는 만들었지만 기본 문서를 만들지 못했습니다: ${documentError.message}`)
  }
}
