import type { AwarenessState, PresenceUser } from '../types/contracts.js'

export function isPresenceUser(value: unknown): value is PresenceUser {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.displayName === 'string' &&
    (typeof value.avatarUrl === 'string' || value.avatarUrl === null) &&
    typeof value.color === 'string'
  )
}

export function isAwarenessState(value: unknown): value is AwarenessState {
  if (!isRecord(value)) return false
  const mode = value.mode
  const cursor = value.cursor
  return (
    isPresenceUser(value.user) &&
    (mode === 'chat' || mode === 'document') &&
    typeof value.lastSeenAt === 'number' &&
    (cursor === undefined ||
      (isRecord(cursor) && typeof cursor.anchor === 'number' && typeof cursor.head === 'number'))
  )
}

export function touchAwarenessState(state: AwarenessState, now = Date.now()): AwarenessState {
  return {
    ...state,
    lastSeenAt: now
  }
}

export function sanitizeAwarenessState(value: unknown): AwarenessState | null {
  if (!isAwarenessState(value)) return null

  const sanitized: AwarenessState = {
    user: {
      id: value.user.id,
      displayName: value.user.displayName,
      avatarUrl: value.user.avatarUrl,
      color: value.user.color
    },
    mode: value.mode,
    lastSeenAt: value.lastSeenAt
  }

  if (value.cursor) {
    sanitized.cursor = {
      anchor: value.cursor.anchor,
      head: value.cursor.head
    }
  }

  return sanitized
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
