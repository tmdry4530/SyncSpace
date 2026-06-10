import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { apiRequest, startTestServer, type TestServer } from './helpers/testServer.js'
import { registerAgentFixture } from './helpers/agentFixture.js'
import { startJobRunner } from '../src/workers/jobRunner.js'
import { processAgentTaskJob } from '../src/workers/agentTaskWorker.js'
import { createLogger } from '../src/utils/logger.js'
import type { AgentProfile } from '../src/types/contracts.js'

let db: EmbeddedDatabase
let server: TestServer
let workspaceId: string
let secret: string

function bearer(): Record<string, string> {
  return { authorization: `Bearer ${secret}` }
}

beforeAll(async () => {
  db = await startEmbeddedDatabase()
  server = await startTestServer(db)
  const reg = await registerAgentFixture({ displayName: 'Agent UI', slug: 'agent-ui' })
  workspaceId = reg.identity.workspaceId
  secret = reg.credential.secret
}, 90_000)

afterAll(async () => {
  await server?.stop()
  await db?.stop()
})

describe('agent REST surface (frontend contract)', () => {
  it('lists the default agent roster for a workspace', async () => {
    const res = await apiRequest<{ agents: AgentProfile[] }>(server, 'GET', `/api/workspaces/${workspaceId}/agents`, {
      useCookies: false,
      headers: bearer()
    })
    expect(res.status).toBe(200)
    const slugs = res.body.agents.map((agent) => agent.slug)
    for (const slug of ['builder', 'doc', 'orchestrator', 'planner', 'reviewer']) {
      expect(slugs).toContain(slug)
    }
    res.body.agents.forEach((agent) => expect(agent.participantId).toBeTruthy())
  })

  it('invokes an agent and the worker drives the task to completion with an artifact', async () => {
    const agents = await apiRequest<{ agents: AgentProfile[] }>(server, 'GET', `/api/workspaces/${workspaceId}/agents`, {
      useCookies: false,
      headers: bearer()
    })
    const planner = agents.body.agents.find((agent) => agent.slug === 'planner')!

    const invoked = await apiRequest<{ task: { id: string; status: { state: string } } }>(
      server,
      'POST',
      `/api/agents/${planner.id}/invoke`,
      { body: { content: '@planner A2A 협업 구조를 설계해줘' }, useCookies: false, headers: bearer() }
    )
    expect(invoked.status).toBe(200)
    const taskId = invoked.body.task.id

    const runner = startJobRunner({
      logger: createLogger('silent'),
      workerId: 'agents-ui-worker',
      queues: [{ name: 'agent', handlers: { agent_task: (p, d) => processAgentTaskJob(p, d) } }]
    })
    await runner.drainOnce()
    await runner.stop()

    const detail = await apiRequest<{ task: any; events: any[] }>(server, 'GET', `/api/tasks/${taskId}`, {
      useCookies: false,
      headers: bearer()
    })
    expect(detail.status).toBe(200)
    expect(detail.body.task.status.state).toBe('TASK_STATE_COMPLETED')
    expect(detail.body.task.artifacts.some((artifact: any) => artifact.artifactId === 'plan.md')).toBe(true)
    expect(detail.body.events.length).toBeGreaterThan(0)

    const list = await apiRequest<{ tasks: any[] }>(server, 'GET', `/api/workspaces/${workspaceId}/tasks`, {
      useCookies: false,
      headers: bearer()
    })
    expect(list.body.tasks.some((task) => task.id === taskId)).toBe(true)
  }, 30_000)

  it('does not expose agents of a workspace to a different agent (cross-workspace 404)', async () => {
    const outsider = await registerAgentFixture({ displayName: 'Outsider', slug: 'outsider' })
    const res = await apiRequest(server, 'GET', `/api/workspaces/${workspaceId}/agents`, {
      useCookies: false,
      headers: { authorization: `Bearer ${outsider.credential.secret}` }
    })
    expect(res.status).toBe(404)
  })
})
