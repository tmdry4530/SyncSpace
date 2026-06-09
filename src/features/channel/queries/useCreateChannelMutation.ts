import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postBackendJson } from '../../../shared/api/backendClient'
import type { Channel } from '../../../shared/types/contracts'
import { workspaceKeys } from '../../workspace/queries/useWorkspacesQuery'

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
  const result = await postBackendJson<{ channel: Channel }>(
    `/api/workspaces/${encodeURIComponent(input.workspaceId)}/channels`,
    { name: input.name }
  )
  return result.channel
}
