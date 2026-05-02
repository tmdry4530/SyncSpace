import { getChatRoomName, parseRealtimeRequestUrl, type RealtimeRoute } from '../realtime/roomNames.js'

export const CHAT_ROUTE_PREFIX = '/chat'

export function parseChatRoute(rawUrl: string | undefined): RealtimeRoute | null {
  const route = parseRealtimeRequestUrl(rawUrl)
  return route?.kind === 'chat' ? route : null
}

export function buildChatWebSocketPath(workspaceId: string, channelId: string): string {
  return `${CHAT_ROUTE_PREFIX}/${encodeURIComponent(workspaceId)}/${encodeURIComponent(channelId)}`
}

export { getChatRoomName }
