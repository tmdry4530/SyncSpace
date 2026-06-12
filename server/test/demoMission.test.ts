import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { apiRequest, startTestServer, type TestServer } from './helpers/testServer.js'
import { registerAgentFixture } from './helpers/agentFixture.js'
import { setPool } from '../src/db/pool.js'
import { getAgentBySlug } from '../src/db/repositories/agentRepository.js'
import { listEvents } from '../src/db/repositories/a2aRepository.js'
import { parseEngineeringEvent, ENGINEERING_EVENT_TYPES } from '../src/a2a/engineeringEvents.js'
import { seedDemoMission } from '../src/demo/missionDemo.js'

let db: EmbeddedDatabase
let server: TestServer
let workspaceId: string
let agentId: string
let createdByParticipantId: string
let bearerHeader: Record<string, string>
let seededTaskId: string

beforeAll(async () => {
  db = await startEmbeddedDatabase()
  server = await startTestServer(db)
  setPool(db.pool, { external: true })

  // Register a fixture agent — this also creates the default roster.
  const reg = await registerAgentFixture({ displayName: 'DemoTest', slug: 'demo-test', role: 'planner' })
  workspaceId = reg.identity.workspaceId
  createdByParticipantId = reg.identity.participantId
  bearerHeader = { authorization: `Bearer ${reg.credential.secret}` }

  // Use the orchestrator from the default roster so FKs are valid.
  const orchestrator = await getAgentBySlug(workspaceId, 'orchestrator')
  expect(orchestrator).not.toBeNull()
  agentId = orchestrator!.id

  // Seed the demo mission.
  const result = await seedDemoMission({ workspaceId, agentId, createdByParticipantId })
  seededTaskId = result.taskId
}, 90_000)

afterAll(async () => {
  await server?.stop()
  await db?.stop()
})

describe('seedDemoMission', () => {
  it('returns a non-empty taskId', () => {
    expect(seededTaskId).toBeTruthy()
    expect(typeof seededTaskId).toBe('string')
  })

  it('the task exists via GET /api/tasks/:taskId', async () => {
    const res = await apiRequest<{ task: { id: string } }>(
      server,
      'GET',
      `/api/tasks/${seededTaskId}`,
      { useCookies: false, headers: bearerHeader }
    )
    expect(res.status).toBe(200)
    expect(res.body.task.id).toBe(seededTaskId)
  })

  it('appended at least 12 engineering events', async () => {
    const events = await listEvents(seededTaskId)
    const engineeringEvents = events.filter((e) => ENGINEERING_EVENT_TYPES.includes(e.event_type as any))
    expect(engineeringEvents.length).toBeGreaterThanOrEqual(12)
  })

  it('EVERY engineering event carries demo === true', async () => {
    const events = await listEvents(seededTaskId)
    const engineeringEvents = events.filter((e) => ENGINEERING_EVENT_TYPES.includes(e.event_type as any))
    for (const ev of engineeringEvents) {
      expect(
        (ev.payload as Record<string, unknown>).demo,
        `event ${ev.event_type} at seq ${ev.seq} missing demo:true`
      ).toBe(true)
    }
  })

  it('every engineering event payload passes parseEngineeringEvent', async () => {
    const events = await listEvents(seededTaskId)
    const engineeringEvents = events.filter((e) => ENGINEERING_EVENT_TYPES.includes(e.event_type as any))
    for (const ev of engineeringEvents) {
      const parsed = parseEngineeringEvent(ev.payload)
      expect(
        parsed,
        `event ${ev.event_type} at seq ${ev.seq} failed parseEngineeringEvent`
      ).not.toBeNull()
    }
  })

  it('all 7 engineering event kinds are present', async () => {
    const events = await listEvents(seededTaskId)
    const presentKinds = new Set(
      events
        .filter((e) => ENGINEERING_EVENT_TYPES.includes(e.event_type as any))
        .map((e) => e.event_type)
    )
    for (const kind of ENGINEERING_EVENT_TYPES) {
      expect(presentKinds.has(kind), `missing engineering kind: ${kind}`).toBe(true)
    }
  })

  it('GET /api/tasks/:taskId returns each engineering type with non-null engineeringEvent', async () => {
    const res = await apiRequest<{ task: unknown; events: Array<{ type: string; payload: unknown }> }>(
      server,
      'GET',
      `/api/tasks/${seededTaskId}`,
      { useCookies: false, headers: bearerHeader }
    )
    expect(res.status).toBe(200)

    const eventsByType = res.body.events.reduce<Record<string, unknown>>((acc, e) => {
      acc[e.type] = e.payload
      return acc
    }, {})

    for (const kind of ENGINEERING_EVENT_TYPES) {
      expect(eventsByType[kind], `REST response missing event type: ${kind}`).toBeDefined()
      const payload = eventsByType[kind] as Record<string, unknown> | undefined
      expect(
        payload?.engineeringEvent,
        `engineeringEvent wrapper missing for ${kind}`
      ).toBeDefined()
      expect(
        (payload?.engineeringEvent as Record<string, unknown>)?.kind,
        `engineeringEvent.kind mismatch for ${kind}`
      ).toBe(kind)
    }
  })
})
