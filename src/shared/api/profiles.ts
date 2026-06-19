import type { AuthUser, PresenceUser, UserProfile } from '../types/contracts'

/** Project the session AuthUser into the lightweight profile shape used across the UI. */
export function authUserToProfile(user: AuthUser): UserProfile {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    color: user.color
  }
}

/** Project the session AuthUser into the presence/awareness shape. */
export function authUserToPresenceUser(user: AuthUser): PresenceUser {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    color: user.color
  }
}
