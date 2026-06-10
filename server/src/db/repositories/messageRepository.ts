import type { ChatMessage, PaginatedChatMessages, ParticipantType, UserProfile } from '../../types/contracts.js'
import { query, queryOne } from '../query.js'
import type { Queryable } from '../query.js'

export interface PersistMessageInput {
  id?: string
  channelId: string
  content: string
  clientId?: string | null
  createdAt?: string
  authorParticipantId: string
  authorType: ParticipantType
  agentId?: string | null
  a2aMessageId?: string | null
  metadata?: Record<string, unknown>
}

export interface ListMessagesInput {
  channelId: string
  cursor?: string | null
  limit: number
}

interface MessageRow {
  id: string
  channel_id: string
  content: string
  client_id: string | null
  created_at: string
  author_participant_id: string | null
  author_type: ParticipantType
  agent_id: string | null
  metadata: Record<string, unknown>
  author_display_name: string | null
  author_avatar_url: string | null
  author_color: string | null
}

const MESSAGE_SELECT = `
  m.id,
  m.channel_id,
  m.content,
  m.client_id,
  m.created_at,
  m.author_participant_id,
  m.author_type,
  m.agent_id,
  m.metadata,
  p.display_name as author_display_name,
  p.avatar_url as author_avatar_url,
  p.color as author_color
`

function toChatMessage(row: MessageRow): ChatMessage {
  const author: UserProfile | undefined = row.author_display_name
    ? {
        id: row.author_participant_id ?? row.id,
        displayName: row.author_display_name,
        avatarUrl: row.author_avatar_url,
        color: row.author_color ?? '#64748b'
      }
    : undefined
  return {
    id: row.id,
    channelId: row.channel_id,
    userId: row.author_participant_id ?? row.id,
    content: row.content,
    createdAt: row.created_at,
    ...(row.client_id ? { clientId: row.client_id } : {}),
    status: 'sent',
    ...(author ? { user: author } : {})
  }
}

function clampLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit <= 0) return 50
  return Math.min(limit, 100)
}

export async function persistMessage(input: PersistMessageInput, client?: Queryable): Promise<ChatMessage> {
  const insert = await query<MessageRow>(
    `with inserted as (
       insert into messages (id, channel_id, content, client_id, created_at,
                             author_participant_id, author_type, agent_id, a2a_message_id, metadata)
       values (coalesce($1, gen_random_uuid()), $2, $3, $4, coalesce($5::timestamptz, now()),
               $6, $7, $8, $9, coalesce($10::jsonb, '{}'::jsonb))
       on conflict (channel_id, client_id) where client_id is not null do nothing
       returning *
     )
     select ${MESSAGE_SELECT}
     from inserted m
     left join participants p on p.id = m.author_participant_id`,
    [
      input.id ?? null,
      input.channelId,
      input.content,
      input.clientId ?? null,
      input.createdAt ?? null,
      input.authorParticipantId,
      input.authorType,
      input.agentId ?? null,
      input.a2aMessageId ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null
    ],
    client
  )

  const row = insert[0]
  if (row) return toChatMessage(row)

  // Conflict on (channel_id, client_id): return the already-persisted row.
  if (input.clientId) {
    const existing = await queryOne<MessageRow>(
      `select ${MESSAGE_SELECT} from messages m
       left join participants p on p.id = m.author_participant_id
       where m.channel_id = $1 and m.client_id = $2`,
      [input.channelId, input.clientId],
      client
    )
    if (existing) return toChatMessage(existing)
  }

  throw new Error('Failed to persist chat message')
}

/** Provenance class of a transcript line, derived server-side (never client-claimed alone). */
export type TranscriptAuthorKind = 'human' | 'internal_agent' | 'remote_agent'

export interface TranscriptMessage {
  id: string
  content: string
  displayName: string | null
  authorKind: TranscriptAuthorKind
}

interface TranscriptRow {
  id: string
  content: string
  author_type: ParticipantType
  agent_id: string | null
  author_display_name: string | null
  author_agent_id: string | null
  author_remote_agent_id: string | null
}

function toTranscriptAuthorKind(row: TranscriptRow): TranscriptAuthorKind {
  if (row.author_type === 'human') return 'human'
  if (row.author_remote_agent_id) return 'remote_agent'
  if (row.author_agent_id ?? row.agent_id) return 'internal_agent'
  // Agent-claimed but not attributable to an internal agent: least-trusted agent class.
  return 'remote_agent'
}

/**
 * Newest-first recent channel messages with author provenance, for LLM
 * transcript building. Provenance comes from the participant row (what the
 * author IS), not from message-level claims, except the human/agent split
 * which lives on the message itself.
 */
export async function listTranscriptMessages(
  channelId: string,
  limit: number,
  workspaceId?: string | null,
  client?: Queryable
): Promise<TranscriptMessage[]> {
  // Defense-in-depth: when a workspaceId is given, only read the channel if it
  // actually belongs to that workspace, so a mis-bound task can never leak another
  // workspace's chat into an LLM prompt or an outbound remote send.
  const params: unknown[] = [channelId, clampLimit(limit)]
  let workspaceClause = ''
  if (workspaceId) {
    params.push(workspaceId)
    workspaceClause = `and exists (select 1 from channels c where c.id = m.channel_id and c.workspace_id = $3)`
  }
  const rows = await query<TranscriptRow>(
    `select m.id, m.content, m.author_type, m.agent_id,
            p.display_name as author_display_name,
            p.agent_id as author_agent_id,
            p.remote_agent_id as author_remote_agent_id
     from messages m
     left join participants p on p.id = m.author_participant_id
     where m.channel_id = $1 ${workspaceClause}
     order by m.created_at desc, m.id desc
     limit $2`,
    params,
    client
  )
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    displayName: row.author_display_name,
    authorKind: toTranscriptAuthorKind(row)
  }))
}

export async function listMessages(input: ListMessagesInput, client?: Queryable): Promise<PaginatedChatMessages> {
  const limit = clampLimit(input.limit)
  const params: unknown[] = [input.channelId, limit + 1]
  let cursorClause = ''
  if (input.cursor) {
    params.push(input.cursor)
    cursorClause = `and m.created_at < $3`
  }

  const rows = await query<MessageRow>(
    `select ${MESSAGE_SELECT}
     from messages m
     left join participants p on p.id = m.author_participant_id
     where m.channel_id = $1 ${cursorClause}
     order by m.created_at desc, m.id desc
     limit $2`,
    params,
    client
  )

  const pageRows = rows.slice(0, limit)
  const nextCursor = rows.length > limit ? pageRows.at(-1)?.created_at ?? null : null
  return {
    items: pageRows.map(toChatMessage),
    nextCursor
  }
}
