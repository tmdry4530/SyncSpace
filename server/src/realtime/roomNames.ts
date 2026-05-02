export type RealtimeRoomKind = 'doc' | 'chat'

export interface RealtimeRoute {
  kind: RealtimeRoomKind
  workspaceId: string
  targetId: string
  roomName: string
  pathname: string
}

export function getDocRoomName(workspaceId: string, documentId: string): string {
  assertSegment('workspaceId', workspaceId)
  assertSegment('documentId', documentId)
  return `doc:${workspaceId}:${documentId}`
}

export function getChatRoomName(workspaceId: string, channelId: string): string {
  assertSegment('workspaceId', workspaceId)
  assertSegment('channelId', channelId)
  return `chat:${workspaceId}:${channelId}`
}

export function parseRealtimeRequestUrl(rawUrl: string | undefined): RealtimeRoute | null {
  if (!rawUrl) return null

  let url: URL
  try {
    url = new URL(rawUrl, 'http://syncspace.local')
  } catch {
    return null
  }

  const parts = url.pathname
    .split('/')
    .filter(Boolean)
    .map((part) => safeDecode(part))

  if (parts.length === 1) {
    return routeFromRoomName(parts[0] ?? '', url.pathname)
  }

  if (parts[0] === 'doc' && parts.length >= 3) {
    const workspaceId = parts[1]
    const documentId = parts[2]
    if (!workspaceId || !documentId) return null
    const roomName = getDocRoomName(workspaceId, documentId)
    return validateOptionalAppendedRoom(parts, roomName)
      ? { kind: 'doc', workspaceId, targetId: documentId, roomName, pathname: url.pathname }
      : null
  }

  if (parts[0] === 'chat' && parts.length >= 3) {
    const workspaceId = parts[1]
    const channelId = parts[2]
    if (!workspaceId || !channelId) return null
    const roomName = getChatRoomName(workspaceId, channelId)
    return validateOptionalAppendedRoom(parts, roomName)
      ? { kind: 'chat', workspaceId, targetId: channelId, roomName, pathname: url.pathname }
      : null
  }

  return null
}

export function routeFromRoomName(roomName: string, pathname = `/${encodeURIComponent(roomName)}`): RealtimeRoute | null {
  const [kind, workspaceId, targetId, ...rest] = roomName.split(':')
  if (rest.length > 0 || !workspaceId || !targetId) return null
  if (kind === 'doc') {
    return { kind, workspaceId, targetId, roomName, pathname }
  }
  if (kind === 'chat') {
    return { kind, workspaceId, targetId, roomName, pathname }
  }
  return null
}

function validateOptionalAppendedRoom(parts: string[], roomName: string): boolean {
  if (parts.length === 3) return true
  return parts.length === 4 && parts[3] === roomName
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function assertSegment(name: string, value: string): void {
  if (!value || value.includes('/')) {
    throw new Error(`Invalid ${name}`)
  }
}
