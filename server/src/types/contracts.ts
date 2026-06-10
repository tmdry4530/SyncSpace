export type ID = string

export interface UserProfile {
  id: ID
  displayName: string
  avatarUrl: string | null
  color: string
}

export interface Workspace {
  id: ID
  name: string
  ownerParticipantId: ID | null
  inviteCode: string
  createdAt: string
}

export interface WorkspaceMember {
  workspaceId: ID
  userId: ID
  role: 'owner' | 'member'
  joinedAt: string
  user: UserProfile
}

export interface Channel {
  id: ID
  workspaceId: ID
  name: string
  createdBy: ID
  createdAt: string
}

export interface ChatMessage {
  id: ID
  channelId: ID
  userId: ID
  content: string
  createdAt: string
  clientId?: string
  status?: 'sent' | 'pending' | 'failed'
  user?: UserProfile
}

export interface DocumentMeta {
  id: ID
  workspaceId: ID
  title: string
  createdBy: ID
  updatedAt: string
}

export interface PresenceUser {
  id: string
  displayName: string
  avatarUrl: string | null
  color: string
}

export interface AwarenessState {
  user: PresenceUser
  cursor?: {
    anchor: number
    head: number
  }
  mode: 'chat' | 'document'
  lastSeenAt: number
}

export interface AppError {
  code: string
  message: string
  details?: unknown
}

export interface PaginatedChatMessages {
  items: ChatMessage[]
  nextCursor: string | null
}

export type ParticipantType = 'human' | 'agent'

export type AgentRole = 'planner' | 'builder' | 'reviewer' | 'doc_writer' | 'orchestrator'

export type AuthAgentKind = 'internal' | 'external'

export type AgentRuntimeStatus =
  | 'idle'
  | 'running'
  | 'waiting_for_input'
  | 'auth_required'
  | 'failed'
  | 'disabled'

export interface ParticipantProfile {
  id: ID
  participantType: ParticipantType
  displayName: string
  avatarUrl: string | null
  color: string
  agentRole?: AgentRole
  agentStatus?: AgentRuntimeStatus
}

export interface AgentProfile {
  id: ID
  workspaceId: ID
  participantId: ID
  slug: string
  displayName: string
  description: string | null
  role: AgentRole
  status: AgentRuntimeStatus
  createdAt: string
  updatedAt: string
}

/** The logged-in identity is an agent, not a human user. */
export interface AuthAgentIdentity {
  kind: AuthAgentKind
  agentId: ID
  participantId: ID
  workspaceId: ID
  displayName: string
  slug: string
  role?: AgentRole
}

export interface RegistrationChallenge {
  challengeId: ID
  prompt: string
  expiresAt: string
}

export interface AgentCredential {
  agentId: ID
  /** Raw secret — shown exactly once at registration. */
  secret: string
}

export interface AgentRegistrationResult {
  credential: AgentCredential
  identity: AuthAgentIdentity
  workspace: Workspace
}

export type RemoteVerificationStatus = 'pending' | 'verified' | 'rejected'
export type RemoteHealthStatus = 'unknown' | 'healthy' | 'unhealthy'

/** A public-safe view of a registered external (remote) agent. Never includes secrets. */
export interface RemoteAgentProfile {
  id: ID
  workspaceId: ID
  slug: string
  name: string
  description: string | null
  agentCardUrl: string
  endpointUrl: string
  protocolVersion: string | null
  skills: unknown[]
  capabilities: Record<string, unknown>
  verificationStatus: RemoteVerificationStatus
  healthStatus: RemoteHealthStatus
  createdAt: string
}

export interface RemoteAgentRegistrationResult {
  id: ID
  slug: string
  status: RemoteVerificationStatus
  verification: {
    type: 'well-known'
    url: string
    token: string
  }
}

export interface ExternalAgentRegistrationResult {
  credential: AgentCredential
  identity: AuthAgentIdentity
  workspace: Workspace
  agent: RemoteAgentProfile
  verification: RemoteAgentRegistrationResult['verification']
}
