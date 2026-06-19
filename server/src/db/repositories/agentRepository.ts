import type { AgentProfile, AgentRole, AgentRuntimeStatus } from '../../types/contracts.js'
import { generateToken, hashToken } from '../../utils/crypto.js'
import { query, queryOne, withTransaction } from '../query.js'
import type { Queryable } from '../query.js'

export interface AgentRow {
  id: string
  workspace_id: string
  slug: string
  display_name: string
  description: string | null
  role: AgentRole
  status: AgentRuntimeStatus
  model_provider: string | null
  model_name: string | null
  system_policy: Record<string, unknown>
  agent_card: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AgentWithParticipant extends AgentRow {
  participant_id: string
}

const AGENT_SELECT = `
  a.id, a.workspace_id, a.slug, a.display_name, a.description, a.role, a.status,
  a.model_provider, a.model_name, a.system_policy, a.agent_card, a.created_at, a.updated_at,
  p.id as participant_id
`

export function toAgentProfile(row: AgentWithParticipant): AgentProfile {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    participantId: row.participant_id,
    slug: row.slug,
    displayName: row.display_name,
    description: row.description,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function listAgents(workspaceId: string, client?: Queryable): Promise<AgentWithParticipant[]> {
  return query<AgentWithParticipant>(
    `select ${AGENT_SELECT}
     from agents a
     join participants p on p.agent_id = a.id
     where a.workspace_id = $1
     order by a.created_at asc`,
    [workspaceId],
    client
  )
}

export async function getAgentById(id: string, client?: Queryable): Promise<AgentWithParticipant | null> {
  return queryOne<AgentWithParticipant>(
    `select ${AGENT_SELECT} from agents a join participants p on p.agent_id = a.id where a.id = $1`,
    [id],
    client
  )
}

export async function getAgentBySlug(
  workspaceId: string,
  slug: string,
  client?: Queryable
): Promise<AgentWithParticipant | null> {
  return queryOne<AgentWithParticipant>(
    `select ${AGENT_SELECT} from agents a join participants p on p.agent_id = a.id
     where a.workspace_id = $1 and a.slug = $2`,
    [workspaceId, slug],
    client
  )
}

export interface CreateAgentInput {
  workspaceId: string
  slug: string
  displayName: string
  role: AgentRole
  description?: string | null
  color?: string
  modelProvider?: string | null
  modelName?: string | null
  systemPolicy?: Record<string, unknown>
  agentCard?: Record<string, unknown>
  createdBy?: string | null
}

/** Create an agent and its agent participant atomically. */
export async function createAgent(input: CreateAgentInput): Promise<AgentWithParticipant> {
  return withTransaction(async (client) => {
    const agentRows = await query<AgentRow>(
      `insert into agents (workspace_id, slug, display_name, description, role, model_provider, model_name, system_policy, agent_card, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, coalesce($8::jsonb, '{}'::jsonb), coalesce($9::jsonb, '{}'::jsonb), $10)
       returning *`,
      [
        input.workspaceId,
        input.slug,
        input.displayName,
        input.description ?? null,
        input.role,
        input.modelProvider ?? null,
        input.modelName ?? null,
        input.systemPolicy ? JSON.stringify(input.systemPolicy) : null,
        input.agentCard ? JSON.stringify(input.agentCard) : null,
        input.createdBy ?? null
      ],
      client
    )
    const agent = agentRows[0]
    if (!agent) throw new Error('Failed to create agent')

    const participantRows = await query<{ id: string }>(
      `insert into participants (participant_type, agent_id, display_name, color)
       values ('agent', $1, $2, $3)
       returning id`,
      [agent.id, agent.display_name, input.color ?? '#0ea5e9'],
      client
    )
    const participantId = participantRows[0]?.id
    if (!participantId) throw new Error('Failed to create agent participant')

    return { ...agent, participant_id: participantId }
  })
}

export async function updateAgentStatus(
  agentId: string,
  status: AgentRuntimeStatus,
  client?: Queryable
): Promise<void> {
  await query(`update agents set status = $2, updated_at = now() where id = $1`, [agentId, status], client)
}

/** Mint an agent token, returning the raw secret once. Only the hash is stored. */
export async function createAgentToken(
  input: { agentId: string; scopes: string[]; pepper: string | null; expiresAt?: Date },
  client?: Queryable
): Promise<{ id: string; token: string }> {
  const token = generateToken(32)
  const tokenHash = hashToken(token, input.pepper)
  const rows = await query<{ id: string }>(
    `insert into agent_tokens (agent_id, token_hash, scopes, expires_at)
     values ($1, $2, $3::text[], $4)
     returning id`,
    [input.agentId, tokenHash, input.scopes, input.expiresAt ? input.expiresAt.toISOString() : null],
    client
  )
  const id = rows[0]?.id
  if (!id) throw new Error('Failed to create agent token')
  return { id, token }
}

export interface DefaultAgentSpec {
  slug: string
  displayName: string
  role: AgentRole
  description: string
  color: string
}

export const DEFAULT_AGENTS: DefaultAgentSpec[] = [
  { slug: 'planner', displayName: 'Planner', role: 'planner', description: '요구사항과 구현 계획을 작성합니다.', color: '#7c3aed' },
  { slug: 'builder', displayName: 'Builder', role: 'builder', description: '계획을 바탕으로 변경안을 제안합니다.', color: '#0891b2' },
  { slug: 'reviewer', displayName: 'Reviewer', role: 'reviewer', description: '보안/권한/리스크를 검토합니다.', color: '#dc2626' },
  { slug: 'doc', displayName: 'DocWriter', role: 'doc_writer', description: '문서에 결과를 정리합니다.', color: '#16a34a' },
  { slug: 'orchestrator', displayName: 'Orchestrator', role: 'orchestrator', description: '에이전트 협업을 조율합니다.', color: '#ea580c' }
]

/** Ensure the default agent roster exists for a workspace (idempotent). */
export async function ensureDefaultAgents(workspaceId: string, createdBy?: string | null): Promise<AgentWithParticipant[]> {
  const result: AgentWithParticipant[] = []
  for (const spec of DEFAULT_AGENTS) {
    const existing = await getAgentBySlug(workspaceId, spec.slug)
    if (existing) {
      result.push(existing)
      continue
    }
    result.push(
      await createAgent({
        workspaceId,
        slug: spec.slug,
        displayName: spec.displayName,
        role: spec.role,
        description: spec.description,
        color: spec.color,
        ...(createdBy ? { createdBy } : {})
      })
    )
  }
  return result
}
