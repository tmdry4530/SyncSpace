import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { apiRequest, bearer, startTestServer, type TestServer } from './helpers/testServer.js'
import { registerAgentFixture } from './helpers/agentFixture.js'
import { createTaskFromMessage } from '../src/a2a/taskService.js'
import { appendEvent } from '../src/db/repositories/a2aRepository.js'
import { newUuid } from '../src/utils/crypto.js'

/**
 * Mission aggregation — cross-task context sharing.
 *
 * Two tasks that share the same a2a context (one mission) must have their
 * engineering events returned together from GET /api/missions/:contextId in
 * seq order, proving cross-task aggregation works.
 *
 * Also verifies:
 *  - GET /api/workspaces/:id/missions lists the mission.
 *  - Cross-workspace access returns 404 (IDOR guard).
 */

let db: EmbeddedDatabase
let server: TestServer
let ownerSecret: string
let ownerParticipantId: string
let workspaceId: string
let ownerAgentId: string

beforeAll(async () => {
  db = await startEmbeddedDatabase()
  server = await startTestServer(db)
  const owner = await registerAgentFixture({ displayName: 'Mission Owner', slug: 'mission-owner', role: 'orchestrator' })
  ownerSecret = owner.credential.secret
  ownerParticipantId = owner.identity.participantId
  workspaceId = owner.identity.workspaceId
  ownerAgentId = owner.credential.agentId
}, 90_000)

afterAll(async () => {
  await server?.stop()
  await db?.stop()
})

describe('cross-task mission aggregation', () => {
  it('events from two tasks sharing a context appear together in GET /api/missions/:contextId', async () => {
    // ── Task 1 (origin) — creates the shared context ──────────────────────────
    const task1Result = await createTaskFromMessage({
      workspaceId,
      agentId: ownerAgentId,
      createdByParticipantId: ownerParticipantId,
      title: 'Mission origin task',
      message: { messageId: newUuid(), parts: [{ text: '결제 모듈 구현해줘' }], role: 'ROLE_USER' },
      enqueue: false
    })
    const task1 = task1Result.task
    const contextId = task1.contextId

    // Append a real engineering event to task 1.
    await appendEvent({
      taskId: task1.id,
      contextId,
      eventType: 'agent_status',
      payload: {
        kind: 'agent_status',
        agentId: ownerAgentId,
        role: 'orchestrator',
        status: 'working',
        currentAction: '계획 중',
        timestamp: new Date().toISOString()
      },
      visibleToUser: true
    })

    // ── Task 2 (collaboration) — REUSES the same context ─────────────────────
    const task2Result = await createTaskFromMessage({
      workspaceId,
      agentId: ownerAgentId,
      contextId, // <-- shared context
      createdByParticipantId: ownerParticipantId,
      title: 'Mission collab task',
      message: { messageId: newUuid(), parts: [{ text: '@builder 구현해줘' }], role: 'ROLE_USER' },
      enqueue: false
    })
    const task2 = task2Result.task
    expect(task2.contextId).toBe(contextId) // must share the same context

    // Append an engineering event to task 2.
    await appendEvent({
      taskId: task2.id,
      contextId,
      eventType: 'pipeline_stage',
      payload: {
        kind: 'pipeline_stage',
        stage: 'implementation',
        status: 'active',
        startedAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      },
      visibleToUser: true
    })

    // ── Fetch the mission and verify cross-task event aggregation ─────────────
    const res = await apiRequest<{
      mission: { contextId: string; workspaceId: string }
      events: { seq: string; taskId: string; type: string }[]
      tasks: { taskId: string }[]
      agents: { agentId: string }[]
    }>(server, 'GET', `/api/missions/${contextId}`, {
      useCookies: false,
      headers: bearer(ownerSecret)
    })

    expect(res.status).toBe(200)
    expect(res.body.mission.contextId).toBe(contextId)
    expect(res.body.mission.workspaceId).toBe(workspaceId)

    // Both tasks should be listed.
    const taskIds = res.body.tasks.map((t) => t.taskId)
    expect(taskIds).toContain(task1.id)
    expect(taskIds).toContain(task2.id)

    // Events from both tasks should be present.
    const eventTaskIds = new Set(res.body.events.map((e) => e.taskId))
    expect(eventTaskIds.has(task1.id)).toBe(true)
    expect(eventTaskIds.has(task2.id)).toBe(true)

    // Events must be in seq (ascending) order.
    const seqs = res.body.events.map((e) => BigInt(e.seq))
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]! >= seqs[i - 1]!).toBe(true)
    }

    // Engineering events from both tasks come back.
    const returnedTypes = res.body.events.map((e) => e.type)
    expect(returnedTypes).toContain('agent_status')
    expect(returnedTypes).toContain('pipeline_stage')
  })

  it('GET /api/workspaces/:id/missions reports EXACT counts (no events×tasks fan-out)', async () => {
    // Self-contained fixture: 2 tasks share ONE context, 3 engineering events
    // total.  A cartesian events×tasks join would report eventCount=6.
    const origin = await createTaskFromMessage({
      workspaceId,
      agentId: ownerAgentId,
      createdByParticipantId: ownerParticipantId,
      title: 'Count fixture origin',
      message: { messageId: newUuid(), parts: [{ text: '카운트 픽스처' }], role: 'ROLE_USER' },
      enqueue: false
    })
    const contextId = origin.task.contextId
    const second = await createTaskFromMessage({
      workspaceId,
      agentId: ownerAgentId,
      contextId,
      createdByParticipantId: ownerParticipantId,
      title: 'Count fixture collab',
      message: { messageId: newUuid(), parts: [{ text: '@builder 진행' }], role: 'ROLE_USER' },
      enqueue: false
    })

    const stamp = new Date().toISOString()
    const events: Array<{ taskId: string; eventType: 'agent_status' | 'pipeline_stage'; payload: Record<string, unknown> }> = [
      {
        taskId: origin.task.id,
        eventType: 'agent_status',
        payload: { kind: 'agent_status', agentId: ownerAgentId, role: 'orchestrator', status: 'working', currentAction: '계획', timestamp: stamp }
      },
      {
        taskId: second.task.id,
        eventType: 'pipeline_stage',
        payload: { kind: 'pipeline_stage', stage: 'implementation', status: 'active', startedAt: stamp, timestamp: stamp }
      },
      {
        taskId: second.task.id,
        eventType: 'agent_status',
        payload: { kind: 'agent_status', agentId: ownerAgentId, role: 'builder', status: 'working', currentAction: '구현', timestamp: stamp }
      }
    ]
    for (const ev of events) {
      await appendEvent({ taskId: ev.taskId, contextId, eventType: ev.eventType, payload: ev.payload, visibleToUser: true })
    }

    const res = await apiRequest<{
      missions: { contextId: string; agentCount: number; eventCount: number }[]
    }>(server, 'GET', `/api/workspaces/${workspaceId}/missions`, {
      useCookies: false,
      headers: bearer(ownerSecret)
    })

    expect(res.status).toBe(200)
    const mission = res.body.missions.find((m) => m.contextId === contextId)
    expect(mission).toBeDefined()
    expect(mission!.eventCount).toBe(3)
    expect(mission!.agentCount).toBe(1)
    // eventCount stays positive for every listed mission.
    for (const m of res.body.missions) {
      expect(m.eventCount).toBeGreaterThan(0)
    }
  })

  it('GET /api/missions/:contextId?sinceSeq returns only newer events (ascending, boundary excluded)', async () => {
    // Build a small mission with several engineering events on one context.
    const origin = await createTaskFromMessage({
      workspaceId,
      agentId: ownerAgentId,
      createdByParticipantId: ownerParticipantId,
      title: 'Incremental fixture',
      message: { messageId: newUuid(), parts: [{ text: '증분 픽스처' }], role: 'ROLE_USER' },
      enqueue: false
    })
    const contextId = origin.task.contextId
    const stamp = new Date().toISOString()
    for (let i = 0; i < 4; i++) {
      await appendEvent({
        taskId: origin.task.id,
        contextId,
        eventType: 'agent_status',
        payload: {
          kind: 'agent_status',
          agentId: ownerAgentId,
          role: 'orchestrator',
          status: 'working',
          currentAction: `step ${i}`,
          timestamp: stamp
        },
        visibleToUser: true
      })
    }

    // Full load establishes the seq ordering we slice against.
    const full = await apiRequest<{
      events: { seq: string; taskId: string }[]
      tasks: { taskId: string }[]
      agents: { agentId: string }[]
    }>(server, 'GET', `/api/missions/${contextId}`, { useCookies: false, headers: bearer(ownerSecret) })
    expect(full.status).toBe(200)
    const fullSeqs = full.body.events.map((e) => BigInt(e.seq))
    expect(fullSeqs.length).toBeGreaterThanOrEqual(4)

    // Pick a boundary in the middle and request the delta after it.
    const boundaryIdx = Math.floor(fullSeqs.length / 2)
    const boundary = fullSeqs[boundaryIdx]!
    const delta = await apiRequest<{
      events: { seq: string }[]
      tasks: { taskId: string }[]
      agents: { agentId: string }[]
    }>(server, 'GET', `/api/missions/${contextId}?sinceSeq=${boundary.toString()}`, {
      useCookies: false,
      headers: bearer(ownerSecret)
    })
    expect(delta.status).toBe(200)

    const deltaSeqs = delta.body.events.map((e) => BigInt(e.seq))
    // Boundary itself must be excluded; everything returned must be strictly newer.
    expect(deltaSeqs.every((s) => s > boundary)).toBe(true)
    // Ascending order.
    for (let i = 1; i < deltaSeqs.length; i++) {
      expect(deltaSeqs[i]! >= deltaSeqs[i - 1]!).toBe(true)
    }
    // Exactly the events after the boundary in the full list.
    const expectedAfter = fullSeqs.filter((s) => s > boundary)
    expect(deltaSeqs).toEqual(expectedAfter)
    // The delta is a superset shape: tasks/agents are intentionally empty.
    expect(delta.body.tasks).toEqual([])
    expect(delta.body.agents).toEqual([])

    // Empty delta when sinceSeq is the latest seq.
    const latest = fullSeqs[fullSeqs.length - 1]!
    const empty = await apiRequest<{ events: { seq: string }[] }>(
      server,
      'GET',
      `/api/missions/${contextId}?sinceSeq=${latest.toString()}`,
      { useCookies: false, headers: bearer(ownerSecret) }
    )
    expect(empty.status).toBe(200)
    expect(empty.body.events).toEqual([])

    // Non-numeric sinceSeq is ignored → full load (tasks/agents present again).
    const fallback = await apiRequest<{
      events: { seq: string }[]
      tasks: { taskId: string }[]
    }>(server, 'GET', `/api/missions/${contextId}?sinceSeq=not-a-number`, {
      useCookies: false,
      headers: bearer(ownerSecret)
    })
    expect(fallback.status).toBe(200)
    expect(fallback.body.events.map((e) => e.seq)).toEqual(full.body.events.map((e) => e.seq))
    expect(fallback.body.tasks.length).toBeGreaterThan(0)
  })

  it('cross-workspace access to GET /api/missions/:contextId returns 404 (IDOR guard)', async () => {
    // Create a mission in workspace A (ownerSecret / workspaceId).
    const task = await createTaskFromMessage({
      workspaceId,
      agentId: ownerAgentId,
      createdByParticipantId: ownerParticipantId,
      message: { messageId: newUuid(), parts: [{ text: 'workspace A mission' }], role: 'ROLE_USER' },
      enqueue: false
    })
    const contextId = task.task.contextId

    // Register workspace B with its own credential.
    const other = await registerAgentFixture({ displayName: 'Other WS Mission', slug: 'other-ws-mission' })

    // Workspace B's credential tries to access workspace A's mission context.
    const res = await apiRequest<{ code?: string }>(server, 'GET', `/api/missions/${contextId}`, {
      useCookies: false,
      headers: bearer(other.credential.secret)
    })

    // Must be 404, not 200 or 403 (no workspace disclosure).
    expect(res.status).toBe(404)
  })
})
