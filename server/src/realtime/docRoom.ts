import { routeFromRoomName } from './roomNames.js'

export interface DocRoomParts {
  workspaceId: string
  documentId: string
}

export function isDocRoomName(roomName: string): boolean {
  return routeFromRoomName(roomName)?.kind === 'doc'
}

export function parseDocRoomName(roomName: string): DocRoomParts | null {
  const route = routeFromRoomName(roomName)
  if (route?.kind !== 'doc') return null
  return {
    workspaceId: route.workspaceId,
    documentId: route.targetId
  }
}
