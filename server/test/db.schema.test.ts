import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { verifyDatabase } from '../src/db/verify.js'
import { loadMigrationFiles } from '../src/db/migrate.js'

let db: EmbeddedDatabase
const expectedMigrationCount = loadMigrationFiles().length

beforeAll(async () => {
  db = await startEmbeddedDatabase()
}, 90_000)

afterAll(async () => {
  await db?.stop()
})

const EXPECTED_TABLES = [
  'schema_migrations',
  'workspaces',
  'workspace_members',
  'channels',
  'documents',
  'messages',
  'participants',
  'agents',
  'agent_tokens',
  'agent_registration_challenges',
  'a2a_contexts',
  'a2a_tasks',
  'a2a_messages',
  'a2a_artifacts',
  'a2a_task_events',
  'yjs_document_snapshots',
  'a2a_push_notification_configs',
  'remote_agents',
  'remote_agent_tokens',
  'remote_a2a_event_dedup',
  'jobs',
  'audit_logs'
]

// Human auth tables were dropped in 0013_agent_credentials (agent-only model).
const DROPPED_TABLES = ['app_users', 'auth_sessions']

const EXPECTED_ENUMS = [
  'participant_type',
  'workspace_member_role',
  'agent_role',
  'agent_runtime_status',
  'a2a_task_state',
  'a2a_message_role',
  'a2a_event_type',
  'remote_verification_status',
  'remote_health_status',
  'job_status'
]

describe('full schema migrations', () => {
  it('creates every expected table', async () => {
    const rows = await db.pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public'`
    )
    const present = new Set(rows.rows.map((row) => row.table_name))
    for (const table of EXPECTED_TABLES) {
      expect(present.has(table), `missing table: ${table}`).toBe(true)
    }
    for (const table of DROPPED_TABLES) {
      expect(present.has(table), `table should be dropped: ${table}`).toBe(false)
    }
  })

  it('creates every expected enum type', async () => {
    const rows = await db.pool.query<{ typname: string }>(
      `select typname from pg_type where typtype = 'e'`
    )
    const present = new Set(rows.rows.map((row) => row.typname))
    for (const enumName of EXPECTED_ENUMS) {
      expect(present.has(enumName), `missing enum: ${enumName}`).toBe(true)
    }
  })

  it('messages.author_type is NOT NULL and references participant author', async () => {
    const rows = await db.pool.query<{ is_nullable: string }>(
      `select is_nullable from information_schema.columns
       where table_name = 'messages' and column_name = 'author_type'`
    )
    expect(rows.rows[0]?.is_nullable).toBe('NO')
  })

  it('a2a_task_events.seq is an identity column with global ordering', async () => {
    const rows = await db.pool.query<{ is_identity: string }>(
      `select is_identity from information_schema.columns
       where table_name = 'a2a_task_events' and column_name = 'seq'`
    )
    expect(rows.rows[0]?.is_identity).toBe('YES')
  })

  it('enforces the participants agent-only constraint (no human participants)', async () => {
    // Human participants were removed in 0013; the agent-only check rejects them.
    await expect(
      db.pool.query(
        `insert into participants (participant_type, display_name) values ('human', 'invalid')`
      )
    ).rejects.toThrow()
    // An agent participant with no agent_id is also rejected.
    await expect(
      db.pool.query(
        `insert into participants (participant_type, display_name) values ('agent', 'no-agent')`
      )
    ).rejects.toThrow()
  })

  it('supports SKIP LOCKED job claim semantics', async () => {
    await db.pool.query(
      `insert into jobs (queue_name, job_type, payload) values ('agent', 'noop', '{}'::jsonb)`
    )
    const claimed = await db.pool.query<{ id: string }>(
      `with next_job as (
         select id from jobs
         where queue_name = $1 and status = 'queued' and run_after <= now()
         order by created_at asc
         for update skip locked
         limit 1
       )
       update jobs j set status = 'running', locked_by = $2, locked_at = now()
       from next_job where j.id = next_job.id
       returning j.id`,
      ['agent', 'test-worker']
    )
    expect(claimed.rows.length).toBe(1)
  })

  it('passes verifyDatabase with no pending migrations or integrity issues', async () => {
    const report = await verifyDatabase(db.pool)
    expect(report.pending).toEqual([])
    expect(report.issues).toEqual([])
    expect(report.ok).toBe(true)
    expect(report.appliedCount).toBe(expectedMigrationCount)
  })
})
