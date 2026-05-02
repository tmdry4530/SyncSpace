import { readClientEnv } from '../types/env'

export function getDocRoomName(workspaceId: string, documentId: string): string {
  return `doc:${workspaceId}:${documentId}`
}

export function getChatRoomName(workspaceId: string, channelId: string): string {
  return `chat:${workspaceId}:${channelId}`
}

export function getDocWsUrl(workspaceId: string, documentId: string): string {
  return `${readClientEnv().wsUrl}/doc/${encodeURIComponent(workspaceId)}/${encodeURIComponent(documentId)}`
}

export function getChatWsUrl(workspaceId: string, channelId: string): string {
  return `${readClientEnv().wsUrl}/chat/${encodeURIComponent(workspaceId)}/${encodeURIComponent(channelId)}`
}
