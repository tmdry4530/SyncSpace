import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { setPool } from '../src/db/pool.js'
import { createLogger } from '../src/utils/logger.js'
import { createUserWithParticipant } from '../src/db/repositories/userRepository.js'
import { createWorkspace } from '../src/db/repositories/workspaceRepository.js'
import { createChannel } from '../src/db/repositories/channelRepository.js'
import { createDocument } from '../src/db/repositories/documentRepository.js'
import { createPostgresMessagePersistenceAdapter } from '../src/persistence/messagePersistencePg.js'
import { PostgresDocStorage } from '../src/realtime/docPersistence.js'

let db: EmbeddedDatabase

beforeAll(async () => {
  db = await startEmbeddedDatabase()
  setPool(db.pool, { external: true })
}, 90_000)

afterAll(async () => {
  await db?.stop()
})

describe('realtime persistence (Postgres)', () => {
  it('persists chat messages with a resolved participant author', async () => {
    const { user } = await createUserWithParticipant({
      email: 'msg@syncspace.dev',
      displayName: 'Msg User',
      passwordHash: null
    })
    const workspace = await createWorkspace({ name: 'WS', ownerId: user.id })
    const channel = await createChannel({ workspaceId: workspace.id, name: 'general', createdBy: user.id })

    const adapter = createPostgresMessagePersistenceAdapter()
    const persisted = await adapter.persistMessage({
      channelId: channel.id,
      userId: user.id,
      content: 'hello world',
      clientId: 'client-1',
      authorType: 'human'
    })
    expect(persisted.content).toBe('hello world')

    const row = await db.pool.query<{ author_participant_id: string | null; author_type: string }>(
      `select author_participant_id, author_type from messages where id = $1`,
      [persisted.id]
    )
    expect(row.rows[0]?.author_participant_id).not.toBeNull()
    expect(row.rows[0]?.author_type).toBe('human')

    // Idempotent on (channel_id, client_id).
    const again = await adapter.persistMessage({
      channelId: channel.id,
      userId: user.id,
      content: 'hello world',
      clientId: 'client-1',
      authorType: 'human'
    })
    expect(again.id).toBe(persisted.id)

    const list = await adapter.listMessages({ channelId: channel.id, limit: 10 })
    expect(list.items).toHaveLength(1)
    expect(list.items[0]?.user?.displayName).toBe('Msg User')
  })

  it('persists and restores a Yjs document snapshot from Postgres', async () => {
    const { user } = await createUserWithParticipant({
      email: 'doc@syncspace.dev',
      displayName: 'Doc User',
      passwordHash: null
    })
    const workspace = await createWorkspace({ name: 'DocWS', ownerId: user.id })
    const document = await createDocument({ workspaceId: workspace.id, title: 'Spec', createdBy: user.id })
    const roomName = `doc:${workspace.id}:${document.id}`

    const source = new Y.Doc()
    source.getText('content').insert(0, 'Persisted in Postgres')
    const update = Y.encodeStateAsUpdate(source)

    const backend = new PostgresDocStorage(createLogger('silent'))
    await backend.write(roomName, update)

    const restoredUpdate = await backend.read(roomName)
    expect(restoredUpdate).not.toBeNull()

    const target = new Y.Doc()
    Y.applyUpdate(target, restoredUpdate!)
    expect(target.getText('content').toString()).toBe('Persisted in Postgres')

    // A second write bumps the version (upsert).
    source.getText('content').insert(source.getText('content').length, '!')
    await backend.write(roomName, Y.encodeStateAsUpdate(source))
    const versionRow = await db.pool.query<{ version: string }>(
      `select version from yjs_document_snapshots where room_name = $1`,
      [roomName]
    )
    expect(Number(versionRow.rows[0]?.version)).toBeGreaterThanOrEqual(2)
  })
})
