import type { ParticipantProfile, ParticipantType } from '../../types/contracts.js'
import { query, queryOne } from '../query.js'
import type { Queryable } from '../query.js'

export interface ParticipantRow {
  id: string
  participant_type: ParticipantType
  agent_id: string | null
  display_name: string
  avatar_url: string | null
  color: string
  agent_role: ParticipantProfile['agentRole'] | null
  agent_status: ParticipantProfile['agentStatus'] | null
}

const PARTICIPANT_SELECT = `
  p.id,
  p.participant_type,
  p.agent_id,
  p.display_name,
  p.avatar_url,
  p.color,
  a.role as agent_role,
  a.status as agent_status
`

export function toParticipantProfile(row: ParticipantRow): ParticipantProfile {
  return {
    id: row.id,
    participantType: row.participant_type,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    color: row.color,
    ...(row.agent_role ? { agentRole: row.agent_role } : {}),
    ...(row.agent_status ? { agentStatus: row.agent_status } : {})
  }
}

export async function getParticipantById(id: string, client?: Queryable): Promise<ParticipantRow | null> {
  return queryOne<ParticipantRow>(
    `select ${PARTICIPANT_SELECT} from participants p
     left join agents a on a.id = p.agent_id
     where p.id = $1`,
    [id],
    client
  )
}

export async function listWorkspaceParticipants(workspaceId: string, client?: Queryable): Promise<ParticipantProfile[]> {
  const rows = await query<ParticipantRow>(
    `select ${PARTICIPANT_SELECT}
     from participants p
     left join agents a on a.id = p.agent_id
     where p.id in (
       select participant_id from workspace_members where workspace_id = $1 and participant_id is not null
       union
       select pp.id from participants pp join agents ag on ag.id = pp.agent_id where ag.workspace_id = $1
     )
     order by p.participant_type, p.display_name`,
    [workspaceId],
    client
  )
  return rows.map(toParticipantProfile)
}
