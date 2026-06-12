import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { apiRequest, startTestServer, type TestServer } from './helpers/testServer.js'
import { registerAgentFixture } from './helpers/agentFixture.js'
import { setPool } from '../src/db/pool.js'
import { appendEvent } from '../src/db/repositories/a2aRepository.js'
import { createTaskFromMessage } from '../src/a2a/taskService.js'
import { getAgentBySlug } from '../src/db/repositories/agentRepository.js'
import {
  parseEngineeringEvent,
  isEngineeringEventType,
  ENGINEERING_EVENT_TYPES
} from '../src/a2a/engineeringEvents.js'

// ---------- Unit tests ----------

describe('engineeringEvents unit', () => {
  it('ENGINEERING_EVENT_TYPES contains all 7 kinds', () => {
    expect(ENGINEERING_EVENT_TYPES).toHaveLength(7)
  })

  it('isEngineeringEventType accepts each engineering kind', () => {
    for (const kind of ENGINEERING_EVENT_TYPES) {
      expect(isEngineeringEventType(kind), `expected ${kind} to be engineering`).toBe(true)
    }
  })

  it('isEngineeringEventType rejects legacy event types', () => {
    expect(isEngineeringEventType('message')).toBe(false)
    expect(isEngineeringEventType('task_snapshot')).toBe(false)
    expect(isEngineeringEventType('status_update')).toBe(false)
    expect(isEngineeringEventType('artifact_update')).toBe(false)
    expect(isEngineeringEventType('push_delivery')).toBe(false)
    expect(isEngineeringEventType('debug')).toBe(false)
    expect(isEngineeringEventType('unknown_random')).toBe(false)
  })

  it('parseEngineeringEvent: agent_status valid', () => {
    const payload = {
      kind: 'agent_status',
      timestamp: new Date().toISOString(),
      agentId: 'agent-1',
      role: 'coder',
      status: 'working',
      currentAction: 'writing tests',
      path: 'src/foo.ts'
    }
    const result = parseEngineeringEvent(payload)
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('agent_status')
  })

  it('parseEngineeringEvent: agent_status missing required field returns null', () => {
    expect(parseEngineeringEvent({ kind: 'agent_status', timestamp: new Date().toISOString(), agentId: 'x' })).toBeNull()
  })

  it('parseEngineeringEvent: pipeline_stage valid', () => {
    const payload = {
      kind: 'pipeline_stage',
      timestamp: new Date().toISOString(),
      stage: 'implementation',
      status: 'active'
    }
    const result = parseEngineeringEvent(payload)
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('pipeline_stage')
  })

  it('parseEngineeringEvent: pipeline_stage invalid status returns null', () => {
    expect(
      parseEngineeringEvent({ kind: 'pipeline_stage', timestamp: new Date().toISOString(), stage: 'implementation', status: 'BOGUS' })
    ).toBeNull()
  })

  it('parseEngineeringEvent: file_edit valid', () => {
    const payload = {
      kind: 'file_edit',
      timestamp: new Date().toISOString(),
      agentId: 'agent-1',
      path: 'src/foo.ts',
      unifiedDiff: '--- a/foo\n+++ b/foo\n@@ -1 +1 @@\n-old\n+new',
      summary: 'renamed variable'
    }
    const result = parseEngineeringEvent(payload)
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('file_edit')
  })

  it('parseEngineeringEvent: command_run valid', () => {
    const payload = {
      kind: 'command_run',
      timestamp: new Date().toISOString(),
      agentId: 'agent-1',
      command: 'pnpm typecheck',
      status: 'success',
      exitCode: 0
    }
    const result = parseEngineeringEvent(payload)
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('command_run')
  })

  it('parseEngineeringEvent: test_result valid', () => {
    const payload = {
      kind: 'test_result',
      timestamp: new Date().toISOString(),
      agentId: 'agent-1',
      suite: 'unit',
      status: 'passed',
      passed: 42,
      failed: 0
    }
    const result = parseEngineeringEvent(payload)
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('test_result')
  })

  it('parseEngineeringEvent: review_comment valid', () => {
    const payload = {
      kind: 'review_comment',
      timestamp: new Date().toISOString(),
      agentId: 'agent-1',
      path: 'src/foo.ts',
      severity: 'warn',
      comment: 'Consider extracting this',
      verdict: 'request_changes'
    }
    const result = parseEngineeringEvent(payload)
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('review_comment')
  })

  it('parseEngineeringEvent: vcs_event valid', () => {
    const payload = {
      kind: 'vcs_event',
      timestamp: new Date().toISOString(),
      agentId: 'agent-1',
      action: 'commit',
      commitSha: 'abc1234',
      summary: 'feat: add engineering events'
    }
    const result = parseEngineeringEvent(payload)
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('vcs_event')
  })

  it('parseEngineeringEvent: bogus kind returns null', () => {
    expect(parseEngineeringEvent({ kind: 'totally_unknown', timestamp: new Date().toISOString() })).toBeNull()
  })

  it('parseEngineeringEvent: non-object returns null', () => {
    expect(parseEngineeringEvent(null)).toBeNull()
    expect(parseEngineeringEvent('string')).toBeNull()
    expect(parseEngineeringEvent(42)).toBeNull()
  })
})

// ---------- Integration tests ----------

let db: EmbeddedDatabase
let server: TestServer
let taskId: string
let contextId: string
let bearerHeader: Record<string, string>
let workspaceId: string

beforeAll(async () => {
  db = await startEmbeddedDatabase()
  server = await startTestServer(db)
  setPool(db.pool, { external: true })

  // Register a fixture agent and get bearer token
  const reg = await registerAgentFixture({ displayName: 'EngTest', slug: 'eng-test', role: 'planner' })
  workspaceId = reg.identity.workspaceId
  const participantId = reg.identity.participantId
  bearerHeader = { authorization: `Bearer ${reg.credential.secret}` }

  // Get the default planner agent to create a task against
  const planner = await getAgentBySlug(workspaceId, 'planner')
  expect(planner).not.toBeNull()

  // Create a task directly (no queue)
  const { task } = await createTaskFromMessage({
    workspaceId,
    agentId: planner!.id,
    createdByParticipantId: participantId,
    message: { messageId: 'eng-test-msg-1', parts: [{ text: 'Engineering event round-trip test' }] },
    enqueue: false
  })
  taskId = task.id
  contextId = task.contextId
}, 90_000)

afterAll(async () => {
  await server?.stop()
  await db?.stop()
})

describe('engineering events integration (migration 0017 + round-trip)', () => {
  const timestamp = new Date().toISOString()
  const agentId = 'test-agent-eng'

  it('appendEvent accepts all 7 engineering event types without error', async () => {
    const payloads: Array<{ type: string; payload: Record<string, unknown> }> = [
      {
        type: 'agent_status',
        payload: { kind: 'agent_status', timestamp, agentId, role: 'coder', status: 'working', currentAction: 'writing tests' }
      },
      {
        type: 'pipeline_stage',
        payload: { kind: 'pipeline_stage', timestamp, stage: 'testing', status: 'active' }
      },
      {
        type: 'file_edit',
        payload: { kind: 'file_edit', timestamp, agentId, path: 'src/foo.ts', unifiedDiff: '-old\n+new', summary: 'rename var' }
      },
      {
        type: 'command_run',
        payload: { kind: 'command_run', timestamp, agentId, command: 'pnpm typecheck', status: 'success', exitCode: 0 }
      },
      {
        type: 'test_result',
        payload: { kind: 'test_result', timestamp, agentId, suite: 'unit', status: 'passed', passed: 10, failed: 0 }
      },
      {
        type: 'review_comment',
        payload: { kind: 'review_comment', timestamp, agentId, path: 'src/foo.ts', severity: 'info', comment: 'LGTM', verdict: 'approve' }
      },
      {
        type: 'vcs_event',
        payload: { kind: 'vcs_event', timestamp, agentId, action: 'commit', commitSha: 'abc123', summary: 'add events' }
      }
    ]

    for (const { type, payload } of payloads) {
      await expect(
        appendEvent({ taskId, contextId, eventType: type as any, payload, visibleToUser: true })
      ).resolves.not.toThrow()
    }
  })

  it('GET /api/tasks/:taskId returns all 7 engineering event kinds with non-null payload', async () => {
    const res = await apiRequest<{ task: unknown; events: Array<{ type: string; payload: unknown }> }>(
      server,
      'GET',
      `/api/tasks/${taskId}`,
      { useCookies: false, headers: bearerHeader }
    )
    expect(res.status).toBe(200)

    const eventTypes = res.body.events.map((e) => e.type)
    const payloads = res.body.events.reduce<Record<string, unknown>>((acc, e) => {
      acc[e.type] = e.payload
      return acc
    }, {})

    for (const kind of ENGINEERING_EVENT_TYPES) {
      expect(eventTypes, `missing event type ${kind}`).toContain(kind)
      expect(payloads[kind], `null payload for ${kind}`).not.toBeNull()
      // Each payload should have the engineeringEvent wrapper from the mapper
      expect((payloads[kind] as any)?.engineeringEvent, `engineeringEvent missing for ${kind}`).toBeDefined()
      expect((payloads[kind] as any)?.engineeringEvent?.kind).toBe(kind)
    }
  })
})
