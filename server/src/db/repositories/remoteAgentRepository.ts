import type {
  RemoteAgentProfile,
  RemoteHealthStatus,
  RemoteVerificationStatus
} from '../../types/contracts.js'
import { generateToken, hashToken } from '../../utils/crypto.js'
import { query, queryOne, withTransaction } from '../query.js'
import type { Queryable } from '../query.js'

export interface RemoteAgentRow {
  id: string
  workspace_id: string
  owner_participant_id: string | null
  slug: string
  name: string
  description: string | null
  agent_card_url: string
  endpoint_url: string
  protocol_version: string | null
  skills_json: unknown[]
  capabilities_json: Record<string, unknown>
  auth_scheme: 'none' | 'bearer' | 'api_key'
  auth_credential_encrypted: string | null
  verification_status: RemoteVerificationStatus
  verification_token_hash: string | null
  verified_at: string | null
  health_status: RemoteHealthStatus
  last_checked_at: string | null
  created_at: string
  updated_at: string
}

const COLUMNS = `
  id, workspace_id, owner_participant_id, slug, name, description, agent_card_url, endpoint_url,
  protocol_version, skills_json, capabilities_json, auth_scheme, auth_credential_encrypted,
  verification_status, verification_token_hash, verified_at, health_status, last_checked_at,
  created_at, updated_at
`

/** Public-safe projection — never leaks verification token hash or credentials. */
export function toRemoteAgentProfile(row: RemoteAgentRow): RemoteAgentProfile {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    agentCardUrl: row.agent_card_url,
    endpointUrl: row.endpoint_url,
    protocolVersion: row.protocol_version,
    skills: Array.isArray(row.skills_json) ? row.skills_json : [],
    capabilities: row.capabilities_json ?? {},
    verificationStatus: row.verification_status,
    healthStatus: row.health_status,
    createdAt: row.created_at
  }
}

export interface CreateRemoteAgentInput {
  workspaceId: string
  ownerParticipantId?: string | null
  slug: string
  name: string
  description?: string | null
  agentCardUrl: string
  endpointUrl: string
  protocolVersion?: string | null
  skills?: unknown[]
  capabilities?: Record<string, unknown>
  verificationTokenHash: string
}

export interface CreatedRemoteAgent {
  agent: RemoteAgentRow
  participantId: string
}

/** Create a remote agent and its agent participant (remote_agent_id) atomically. */
export async function createRemoteAgent(input: CreateRemoteAgentInput, outerClient?: Queryable): Promise<CreatedRemoteAgent> {
  const run = async (client: Queryable): Promise<CreatedRemoteAgent> => {
    const rows = await query<RemoteAgentRow>(
      `insert into remote_agents
         (workspace_id, owner_participant_id, slug, name, description, agent_card_url, endpoint_url,
          protocol_version, skills_json, capabilities_json, verification_token_hash)
       values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9::jsonb, '[]'::jsonb), coalesce($10::jsonb, '{}'::jsonb), $11)
       returning ${COLUMNS}`,
      [
        input.workspaceId,
        input.ownerParticipantId ?? null,
        input.slug,
        input.name,
        input.description ?? null,
        input.agentCardUrl,
        input.endpointUrl,
        input.protocolVersion ?? null,
        input.skills ? JSON.stringify(input.skills) : null,
        input.capabilities ? JSON.stringify(input.capabilities) : null,
        input.verificationTokenHash
      ],
      client
    )
    const agent = rows[0]
    if (!agent) throw new Error('Failed to create remote agent')

    const participantRows = await query<{ id: string }>(
      `insert into participants (participant_type, remote_agent_id, display_name, color)
       values ('agent', $1, $2, $3)
       returning id`,
      [agent.id, agent.name, '#0f766e'],
      client
    )
    const participantId = participantRows[0]?.id
    if (!participantId) throw new Error('Failed to create remote agent participant')

    return { agent, participantId }
  }
  return outerClient ? run(outerClient) : withTransaction(run)
}

export async function getRemoteAgentById(id: string, client?: Queryable): Promise<RemoteAgentRow | null> {
  return queryOne<RemoteAgentRow>(`select ${COLUMNS} from remote_agents where id = $1`, [id], client)
}

export async function getRemoteAgentBySlug(
  workspaceId: string,
  slug: string,
  client?: Queryable
): Promise<RemoteAgentRow | null> {
  return queryOne<RemoteAgentRow>(
    `select ${COLUMNS} from remote_agents where workspace_id = $1 and slug = $2`,
    [workspaceId, slug],
    client
  )
}

export async function listRemoteAgents(workspaceId: string, client?: Queryable): Promise<RemoteAgentRow[]> {
  return query<RemoteAgentRow>(
    `select ${COLUMNS} from remote_agents where workspace_id = $1 order by created_at asc`,
    [workspaceId],
    client
  )
}

/** The participant id backing a remote agent (used as message/task author). */
export async function getRemoteAgentParticipantId(remoteAgentId: string, client?: Queryable): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    `select id from participants where remote_agent_id = $1`,
    [remoteAgentId],
    client
  )
  return row?.id ?? null
}

export async function setVerificationStatus(
  id: string,
  status: RemoteVerificationStatus,
  client?: Queryable
): Promise<void> {
  await query(
    `update remote_agents
     set verification_status = $2::remote_verification_status,
         verified_at = case when $2::remote_verification_status = 'verified' then now() else verified_at end
     where id = $1`,
    [id, status],
    client
  )
}

export async function setHealthStatus(id: string, status: RemoteHealthStatus, client?: Queryable): Promise<void> {
  await query(
    `update remote_agents set health_status = $2, last_checked_at = now() where id = $1`,
    [id, status],
    client
  )
}

export async function deleteRemoteAgent(id: string, client?: Queryable): Promise<void> {
  await query(`delete from remote_agents where id = $1`, [id], client)
}

export async function setRemoteAgentOwner(
  id: string,
  ownerParticipantId: string,
  client?: Queryable
): Promise<void> {
  await query(`update remote_agents set owner_participant_id = $2 where id = $1`, [id, ownerParticipantId], client)
}

/** Mint a remote-agent token, returning the raw secret once. Only the hash is stored. */
export async function createRemoteAgentToken(
  input: { remoteAgentId: string; scopes: string[]; pepper: string | null; expiresAt?: Date },
  client?: Queryable
): Promise<{ id: string; token: string }> {
  const token = generateToken(32)
  const tokenHash = hashToken(token, input.pepper)
  const rows = await query<{ id: string }>(
    `insert into remote_agent_tokens (remote_agent_id, token_hash, scopes, expires_at)
     values ($1, $2, $3::text[], $4)
     returning id`,
    [input.remoteAgentId, tokenHash, input.scopes, input.expiresAt ? input.expiresAt.toISOString() : null],
    client
  )
  const id = rows[0]?.id
  if (!id) throw new Error('Failed to create remote agent token')
  return { id, token }
}
