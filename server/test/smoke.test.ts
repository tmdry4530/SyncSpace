import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { apiRequest, startTestServer, type TestServer } from './helpers/testServer.js'
import { seed } from '../src/db/seed.js'
import { startJobRunner } from '../src/workers/jobRunner.js'
import { processAgentTaskJob } from '../src/workers/agentTaskWorker.js'
import { createLogger } from '../src/utils/logger.js'
import type { AgentProfile, Workspace } from '../src/types/contracts.js'

let db: EmbeddedDatabase
let server: TestServer

beforeAll(async () => {
  db = await startEmbeddedDatabase()
  server = await startTestServer(db)
  await seed(() => undefined) // the real dev seed (idempotent)
}, 90_000)

afterAll(async () => {
  await server?.stop()
  await db?.stop()
})

/** Mirrors the plan's section 10.2 smoke checklist against the real seed + server. */
describe('end-to-end smoke (seeded)', () => {
  it('runs the full user journey: login -> workspace -> agents -> invoke -> completed task', async () => {
    // 1. Login as a seeded user.
    const login = await apiRequest<{ user: { email: string } }>(server, 'POST', '/api/auth/login', {
      body: { email: 'ada@syncspace.dev', password: 'password123' }
    })
    expect(login.status).toBe(200)
    expect(login.body.user.email).toBe('ada@syncspace.dev')

    // 2. Workspace list shows the seeded demo workspace.
    const workspaces = await apiRequest<{ workspaces: Workspace[] }>(server, 'GET', '/api/workspaces')
    const demo = workspaces.body.workspaces.find((ws) => ws.name === 'SyncSpace Demo')
    expect(demo).toBeTruthy()
    const workspaceId = demo!.id

    // 3. Channels, documents seeded.
    const channels = await apiRequest<{ channels: { id: string; name: string }[] }>(server, 'GET', `/api/workspaces/${workspaceId}/channels`)
    expect(channels.body.channels.some((c) => c.name === 'general')).toBe(true)
    const documents = await apiRequest<{ documents: { title: string }[] }>(server, 'GET', `/api/workspaces/${workspaceId}/documents`)
    expect(documents.body.documents.length).toBeGreaterThan(0)

    // 4. Agent roster present.
    const agentsRes = await apiRequest<{ agents: AgentProfile[] }>(server, 'GET', `/api/workspaces/${workspaceId}/agents`)
    expect(agentsRes.body.agents.length).toBe(5)
    const planner = agentsRes.body.agents.find((a) => a.slug === 'planner')!

    // 5. Invoke @planner -> task created.
    const channelId = channels.body.channels.find((c) => c.name === 'general')!.id
    const invoke = await apiRequest<{ task: { id: string } }>(server, 'POST', `/api/agents/${planner.id}/invoke`, {
      body: { content: '@planner SyncSpace에 A2A 협업 구조를 설계해줘', channelId }
    })
    expect(invoke.status).toBe(200)

    // 6. Worker completes the task with an artifact + chat mirror message.
    const runner = startJobRunner({
      logger: createLogger('silent'),
      workerId: 'smoke-worker',
      queues: [{ name: 'agent', handlers: { agent_task: (p, d) => processAgentTaskJob(p, d) } }]
    })
    await runner.drainOnce()
    await runner.stop()

    const detail = await apiRequest<{ task: any }>(server, 'GET', `/api/tasks/${invoke.body.task.id}`)
    expect(detail.body.task.status.state).toBe('TASK_STATE_COMPLETED')
    expect(detail.body.task.artifacts.some((a: any) => a.artifactId === 'plan.md')).toBe(true)

    // 7. Agent chat-mirror message persisted to the channel as the agent participant.
    const messages = await apiRequest<{ items: { content: string; user?: { displayName: string } }[] }>(
      server,
      'GET',
      `/api/channels/${channelId}/messages`
    )
    expect(messages.body.items.some((m) => m.user?.displayName === 'Planner')).toBe(true)
  }, 40_000)

  it('serves the public A2A Agent Card', async () => {
    const card = await apiRequest<{ name: string; capabilities: { streaming: boolean } }>(
      server,
      'GET',
      '/.well-known/agent-card.json',
      { useCookies: false }
    )
    expect(card.status).toBe(200)
    expect(card.body.capabilities.streaming).toBe(true)
  })

  it('reports health with database + realtime status', async () => {
    const health = await apiRequest<{ ok: boolean; database: string }>(server, 'GET', '/health', { useCookies: false })
    expect(health.body.ok).toBe(true)
    expect(health.body.database).toBe('ok')
  })
})
