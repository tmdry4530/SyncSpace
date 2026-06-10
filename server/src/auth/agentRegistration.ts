import type { ServerConfig } from '../config.js'
import type { AgentRegistrationResult, AgentRole, AuthAgentIdentity } from '../types/contracts.js'
import { withTransaction } from '../db/query.js'
import {
  createAgent,
  createAgentToken,
  ensureDefaultAgents,
  type AgentWithParticipant
} from '../db/repositories/agentRepository.js'
import { addWorkspaceMember, createWorkspace, setWorkspaceOwner } from '../db/repositories/workspaceRepository.js'
import { ALL_AUTH_SCOPES } from './context.js'

const VALID_ROLES: AgentRole[] = ['planner', 'builder', 'reviewer', 'doc_writer', 'orchestrator']

export interface RegisterAgentInput {
  displayName: string
  slug?: string
  role?: AgentRole
  description?: string | null
  color?: string
  workspaceName?: string
}

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || 'agent'
}

export function toIdentity(agent: AgentWithParticipant): AuthAgentIdentity {
  return {
    kind: 'internal',
    agentId: agent.id,
    participantId: agent.participant_id,
    workspaceId: agent.workspace_id,
    displayName: agent.display_name,
    slug: agent.slug,
    role: agent.role
  }
}

/**
 * Provision a freshly-registered agent: a workspace it owns, the agent + its
 * participant, an owner membership, the default collaborator roster, and an
 * agent token (the secret) granting all scopes. Returns the secret exactly once.
 */
export async function registerAgent(config: ServerConfig, input: RegisterAgentInput): Promise<AgentRegistrationResult> {
  const displayName = input.displayName.trim().slice(0, 80) || 'Agent'
  const role: AgentRole = input.role && VALID_ROLES.includes(input.role) ? input.role : 'planner'
  const slug = slugify(input.slug ?? displayName)
  const workspaceName = (input.workspaceName?.trim() || `${displayName} Workspace`).slice(0, 120)

  return withTransaction(async (client) => {
    const workspace = await createWorkspace({ name: workspaceName }, client)
    const agent = await createAgent(
      {
        workspaceId: workspace.id,
        slug,
        displayName,
        role,
        description: input.description ?? null,
        ...(input.color ? { color: input.color } : {})
      },
      client
    )
    await setWorkspaceOwner(workspace.id, agent.participant_id, client)
    await addWorkspaceMember({ workspaceId: workspace.id, participantId: agent.participant_id, role: 'owner' }, client)
    // Seed collaborators; skips the registered agent's slug if it collides.
    await ensureDefaultAgents(workspace.id, client)
    const token = await createAgentToken(
      { agentId: agent.id, scopes: [...ALL_AUTH_SCOPES], pepper: config.agentTokenPepper },
      client
    )

    return {
      credential: { agentId: agent.id, secret: token.token },
      identity: toIdentity(agent),
      workspace: { ...workspace, ownerParticipantId: agent.participant_id }
    }
  })
}
