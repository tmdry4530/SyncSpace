import { getDocRoomName, parseRealtimeRequestUrl, type RealtimeRoute } from '../realtime/roomNames.js'

export const DOC_ROUTE_PREFIX = '/doc'

export function parseDocRoute(rawUrl: string | undefined): RealtimeRoute | null {
  const route = parseRealtimeRequestUrl(rawUrl)
  return route?.kind === 'doc' ? route : null
}

export function buildDocWebSocketPath(workspaceId: string, documentId: string): string {
  return `${DOC_ROUTE_PREFIX}/${encodeURIComponent(workspaceId)}/${encodeURIComponent(documentId)}`
}

export { getDocRoomName }
