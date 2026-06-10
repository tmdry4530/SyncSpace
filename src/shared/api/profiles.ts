import type { AuthAgentIdentity, PresenceUser, UserProfile } from '../types/contracts'

const AGENT_COLORS: [string, ...string[]] = ['#8b5cf6', '#10b981', '#0ea5e9', '#f59e0b', '#ef4444', '#ec4899']

/** Deterministic accent color derived from a stable id (so the same agent keeps one color). */
function colorForId(id: string): string {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  }
  return AGENT_COLORS[hash % AGENT_COLORS.length] ?? AGENT_COLORS[0]
}

/** Project the session agent identity into the lightweight profile shape used across the UI. */
export function agentIdentityToProfile(identity: AuthAgentIdentity): UserProfile {
  return {
    id: identity.participantId,
    displayName: identity.displayName,
    avatarUrl: null,
    color: colorForId(identity.participantId)
  }
}

/** Project the session agent identity into the presence/awareness shape. */
export function agentIdentityToPresenceUser(identity: AuthAgentIdentity): PresenceUser {
  return {
    id: identity.participantId,
    displayName: identity.displayName,
    avatarUrl: null,
    color: colorForId(identity.participantId)
  }
}
