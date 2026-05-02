import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '../../shared/api/supabaseClient'
import { useAuthStore } from '../../shared/stores/authStore'
import { messageKeys } from '../chat/queries/useMessagesInfiniteQuery'
import { workspaceKeys } from '../workspace/queries/useWorkspacesQuery'


export function useWorkspacesRealtime() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  useEffect(() => {
    if (!userId) return
    const supabase = getSupabaseClient()
    if (!supabase) return

    const invalidateWorkspaces = () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
    }

    const channel = supabase
      .channel(`syncspace:workspaces:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, invalidateWorkspaces)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members' }, invalidateWorkspaces)
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, userId])
}

export function useWorkspaceServerRealtime(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  useEffect(() => {
    if (!workspaceId || !userId) return
    const supabase = getSupabaseClient()
    if (!supabase) return

    const invalidateWorkspace = () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
    }
    const invalidateChannels = () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.channels(workspaceId) })
    }
    const invalidateDocuments = () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.documents(workspaceId) })
    }

    const channel = supabase
      .channel(`syncspace:workspace:${workspaceId}:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` }, invalidateWorkspace)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}` }, invalidateWorkspace)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels', filter: `workspace_id=eq.${workspaceId}` }, invalidateChannels)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `workspace_id=eq.${workspaceId}` }, invalidateDocuments)
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, userId, workspaceId])
}

export function useChannelMessagesRealtime(channelId: string | null | undefined) {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  useEffect(() => {
    if (!channelId || !userId) return
    const supabase = getSupabaseClient()
    if (!supabase) return

    const invalidateMessages = () => {
      void queryClient.invalidateQueries({ queryKey: messageKeys.channel(channelId) })
    }

    const channel = supabase
      .channel(`syncspace:messages:${channelId}:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` }, invalidateMessages)
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [channelId, queryClient, userId])
}
