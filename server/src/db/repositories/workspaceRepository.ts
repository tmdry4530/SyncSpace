import type { Workspace } from '../../types/contracts.js'
import { query, queryOne } from '../query.js'
import type { Queryable } from '../query.js'

interface WorkspaceRow {
  id: string
  name: string
  owner_participant_id: string | null
  invite_code: string
  created_at: string
}

function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    ownerParticipantId: row.owner_participant_id,
    inviteCode: row.invite_code,
    createdAt: row.created_at
  }
}

const WORKSPACE_COLUMNS = `id, name, owner_participant_id, invite_code, created_at`

/** Workspaces the given participant belongs to (its own working environment). */
export async function listWorkspacesForParticipant(participantId: string, client?: Queryable): Promise<Workspace[]> {
  const rows = await query<WorkspaceRow>(
    `select ${WORKSPACE_COLUMNS.split(',').map((c) => `w.${c.trim()}`).join(', ')}
     from workspaces w
     join workspace_members wm on wm.workspace_id = w.id
     where wm.participant_id = $1
     order by w.created_at asc`,
    [participantId],
    client
  )
  return rows.map(toWorkspace)
}

export async function getWorkspaceById(id: string, client?: Queryable): Promise<Workspace | null> {
  const row = await queryOne<WorkspaceRow>(`select ${WORKSPACE_COLUMNS} from workspaces where id = $1`, [id], client)
  return row ? toWorkspace(row) : null
}

/**
 * Look up a workspace by its shareable invite code (stored upper-cased).
 * Expired codes (invite_code_expires_at in the past) resolve to null; a null
 * expiry means the code never expires.
 */
export async function getWorkspaceByInviteCode(inviteCode: string, client?: Queryable): Promise<Workspace | null> {
  const normalized = inviteCode.trim().toUpperCase()
  if (!normalized) return null
  const row = await queryOne<WorkspaceRow>(
    `select ${WORKSPACE_COLUMNS} from workspaces
     where invite_code = $1
       and (invite_code_expires_at is null or invite_code_expires_at > now())`,
    [normalized],
    client
  )
  return row ? toWorkspace(row) : null
}

/**
 * Regenerate a workspace's invite code (10-char upper, matching the 0003
 * generation style) and stamp invite_code_rotated_at. Returns the new code.
 * Any previously shared code stops resolving immediately.
 */
export async function rotateInviteCode(workspaceId: string, client?: Queryable): Promise<string> {
  const row = await queryOne<{ invite_code: string }>(
    `update workspaces
     set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
         invite_code_rotated_at = now()
     where id = $1
     returning invite_code`,
    [workspaceId],
    client
  )
  if (!row) throw new Error('Failed to rotate invite code')
  return row.invite_code
}

export interface MembershipRow {
  role: string
  member_role: string | null
  participant_id: string | null
}

export async function getMembership(
  workspaceId: string,
  participantId: string,
  client?: Queryable
): Promise<MembershipRow | null> {
  return queryOne<MembershipRow>(
    `select role, member_role, participant_id from workspace_members where workspace_id = $1 and participant_id = $2`,
    [workspaceId, participantId],
    client
  )
}

export async function createWorkspace(
  input: { name: string; ownerParticipantId?: string | null },
  client?: Queryable
): Promise<Workspace> {
  const rows = await query<WorkspaceRow>(
    `insert into workspaces (name, owner_participant_id) values ($1, $2) returning ${WORKSPACE_COLUMNS}`,
    [input.name, input.ownerParticipantId ?? null],
    client
  )
  const row = rows[0]
  if (!row) throw new Error('Failed to create workspace')
  return toWorkspace(row)
}

export async function setWorkspaceOwner(
  workspaceId: string,
  participantId: string,
  client?: Queryable
): Promise<void> {
  await query(`update workspaces set owner_participant_id = $2 where id = $1`, [workspaceId, participantId], client)
}

export async function addWorkspaceMember(
  input: { workspaceId: string; participantId: string; role?: 'owner' | 'member' },
  client?: Queryable
): Promise<void> {
  const role = input.role ?? 'member'
  await query(
    `insert into workspace_members (workspace_id, participant_id, role, member_role)
     values ($1, $2, $3, $4::workspace_member_role)
     on conflict (workspace_id, participant_id) do nothing`,
    [input.workspaceId, input.participantId, role, role],
    client
  )
}

export async function deleteWorkspace(workspaceId: string, client?: Queryable): Promise<void> {
  await query(`delete from workspaces where id = $1`, [workspaceId], client)
}
