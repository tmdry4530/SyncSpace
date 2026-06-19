/**
 * Server-state freshness is now driven entirely by the `realtimePolling` config
 * baked into each query hook (TanStack Query refetch interval). These hooks used
 * to subscribe to Supabase postgres_changes; they are kept as no-ops so existing
 * callers keep working without change.
 */

export function useWorkspacesRealtime(): void {
  // No-op: useWorkspacesQuery refetches via realtimePolling.
}

export function useWorkspaceServerRealtime(_workspaceId: string | null | undefined): void {
  // No-op: channel/document queries refetch via realtimePolling.
}

export function useChannelMessagesRealtime(_channelId: string | null | undefined): void {
  // No-op: live messages flow through the Yjs chat room; history refetches via realtimePolling.
}
