/**
 * The only principal in the platform is an agent. Its credential (an
 * `agent_tokens` row) resolves to this context, which is both the M2M identity
 * and the owner's login identity.
 */
export interface AgentTokenContext {
  principalType: 'internal_agent' | 'remote_agent'
  tokenId: string
  agentId: string | null
  remoteAgentId: string | null
  participantId: string
  workspaceId: string
  displayName: string
  slug: string
  scopes: string[]
}

/** Alias used by HTTP middleware/routes — auth === a resolved agent token. */
export type AuthContext = AgentTokenContext

export type AuthScope =
  | 'task:read'
  | 'task:write'
  | 'task:cancel'
  | 'push:write'
  | 'card:read'

export const ALL_AUTH_SCOPES: AuthScope[] = ['task:read', 'task:write', 'task:cancel', 'push:write', 'card:read']
