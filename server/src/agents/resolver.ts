import { getAgentBySlug, type AgentWithParticipant } from '../db/repositories/agentRepository.js'
import { getRemoteAgentBySlug, type RemoteAgentRow } from '../db/repositories/remoteAgentRepository.js'

export type ResolvedAgent =
  | { kind: 'internal'; agent: AgentWithParticipant }
  | { kind: 'remote'; agent: RemoteAgentRow }

/**
 * Server-authoritative `@slug` resolution. Internal agents win over remote on a
 * slug collision; returns null when nothing matches (caller maps to 404). The
 * caller enforces remote invocation gating (verified + healthy + workspace).
 */
export async function resolveAgentByMention(workspaceId: string, slug: string): Promise<ResolvedAgent | null> {
  const internal = await getAgentBySlug(workspaceId, slug)
  if (internal) return { kind: 'internal', agent: internal }
  const remote = await getRemoteAgentBySlug(workspaceId, slug)
  if (remote) return { kind: 'remote', agent: remote }
  return null
}
