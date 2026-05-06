import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getAuthenticatedUser } from '../../../shared/api/auth'
import { requireSupabaseClient } from '../../../shared/api/supabaseClient'
import type { Channel } from '../../../shared/types/contracts'
import { workspaceKeys } from '../../workspace/queries/useWorkspacesQuery'
import { mapChannel } from './useChannelsQuery'

export function useCreateChannelMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string }) => createChannel({ workspaceId: workspaceId!, name: input.name }),
    onSuccess: (channel) => {
      if (!workspaceId) return
      queryClient.setQueryData<Channel[]>(workspaceKeys.channels(workspaceId), (current = []) => {
        if (current.some((item) => item.id === channel.id)) return current
        return [...current, channel].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      })
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.channels(workspaceId) })
    }
  })
}

async function createChannel(input: { workspaceId: string; name: string }): Promise<Channel> {
  const supabase = requireSupabaseClient()
  const user = await getAuthenticatedUser(supabase)
  const { error: insertError } = await supabase
    .from('channels')
    .insert({ workspace_id: input.workspaceId, name: input.name, created_by: user.id })

  if (insertError) throw insertError

  const { data, error } = await supabase
    .from('channels')
    .select('id,workspace_id,name,created_by,created_at')
    .eq('workspace_id', input.workspaceId)
    .eq('name', input.name)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('채널을 만들었지만 목록에서 확인하지 못했습니다. 잠시 후 새로고침하세요.')
  return mapChannel(data)
}
