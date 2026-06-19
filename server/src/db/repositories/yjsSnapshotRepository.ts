import { query, queryOne } from '../query.js'
import type { Queryable } from '../query.js'

export interface YjsSnapshotRow {
  room_name: string
  workspace_id: string
  document_id: string
  state_update: Buffer
  version: string
}

export async function readSnapshot(roomName: string, client?: Queryable): Promise<Uint8Array | null> {
  const row = await queryOne<{ state_update: Buffer }>(
    `select state_update from yjs_document_snapshots where room_name = $1`,
    [roomName],
    client
  )
  return row ? new Uint8Array(row.state_update) : null
}

export async function upsertSnapshot(
  input: { roomName: string; workspaceId: string; documentId: string; stateUpdate: Uint8Array },
  client?: Queryable
): Promise<void> {
  await query(
    `insert into yjs_document_snapshots (room_name, workspace_id, document_id, state_update, version, updated_at)
     values ($1, $2, $3, $4, 1, now())
     on conflict (room_name) do update
       set state_update = excluded.state_update,
           version = yjs_document_snapshots.version + 1,
           updated_at = now()`,
    [input.roomName, input.workspaceId, input.documentId, Buffer.from(input.stateUpdate)],
    client
  )
}
