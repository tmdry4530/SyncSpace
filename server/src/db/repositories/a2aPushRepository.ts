import { query, queryOne } from '../query.js'
import type { Queryable } from '../query.js'

export interface PushConfigRow {
  id: string
  task_id: string
  config_id: string
  url: string
  auth_scheme: string
  auth_credentials_hash: string | null
  authentication: Record<string, unknown>
  created_by_participant_id: string | null
  created_at: string
  deleted_at: string | null
}

export async function createPushConfig(
  input: {
    taskId: string
    configId: string
    url: string
    authScheme?: string
    authCredentialsHash?: string | null
    authentication?: Record<string, unknown>
    createdByParticipantId?: string | null
  },
  client?: Queryable
): Promise<PushConfigRow> {
  const rows = await query<PushConfigRow>(
    `insert into a2a_push_notification_configs
       (task_id, config_id, url, auth_scheme, auth_credentials_hash, authentication, created_by_participant_id)
     values ($1, $2, $3, coalesce($4, 'Bearer'), $5, coalesce($6::jsonb, '{}'::jsonb), $7)
     on conflict (task_id, config_id) do update
       set url = excluded.url,
           auth_scheme = excluded.auth_scheme,
           auth_credentials_hash = excluded.auth_credentials_hash,
           authentication = excluded.authentication,
           deleted_at = null
     returning *`,
    [
      input.taskId,
      input.configId,
      input.url,
      input.authScheme ?? null,
      input.authCredentialsHash ?? null,
      input.authentication ? JSON.stringify(input.authentication) : null,
      input.createdByParticipantId ?? null
    ],
    client
  )
  const row = rows[0]
  if (!row) throw new Error('Failed to create push config')
  return row
}

export async function listPushConfigs(taskId: string, client?: Queryable): Promise<PushConfigRow[]> {
  return query<PushConfigRow>(
    `select * from a2a_push_notification_configs where task_id = $1 and deleted_at is null order by created_at asc`,
    [taskId],
    client
  )
}

export async function getPushConfig(taskId: string, configId: string, client?: Queryable): Promise<PushConfigRow | null> {
  return queryOne<PushConfigRow>(
    `select * from a2a_push_notification_configs where task_id = $1 and config_id = $2 and deleted_at is null`,
    [taskId, configId],
    client
  )
}

export async function deletePushConfig(taskId: string, configId: string, client?: Queryable): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `update a2a_push_notification_configs set deleted_at = now()
     where task_id = $1 and config_id = $2 and deleted_at is null
     returning id`,
    [taskId, configId],
    client
  )
  return rows.length > 0
}
