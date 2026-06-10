import { queryOne } from '../query.js'
import type { Queryable } from '../query.js'

/**
 * Claim an external event key for a local task. Returns true exactly once per
 * (localTaskId, key); subsequent calls with the same key return false. Used to
 * mirror each remote artifact/message into local events only once despite repeated
 * polling.
 */
export async function tryClaimRemoteEvent(
  localTaskId: string,
  externalEventKey: string,
  client?: Queryable
): Promise<boolean> {
  const row = await queryOne<{ claimed: boolean }>(
    `insert into remote_a2a_event_dedup (local_task_id, external_event_key)
     values ($1, $2)
     on conflict (local_task_id, external_event_key) do nothing
     returning true as claimed`,
    [localTaskId, externalEventKey],
    client
  )
  return Boolean(row?.claimed)
}
