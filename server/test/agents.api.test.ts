import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { apiRequest, startTestServer, type TestServer } from './helpers/testServer.js'
import { startJobRunner } from '../src/workers/jobRunner.js'
import { processAgentTaskJob } from '../src/workers/agentTaskWorker.js'
import { createLogger } from '../src/utils/logger.js'
import type { AgentProfile, Workspace } from '../src/types/contracts.js'

let db: EmbeddedDatabase
let server: TestServer
let workspaceId: string

beforeAll(async () => {
  db = await startEmbeddedDatabase()
  server = await startTestServer(db)
  await apiRequest(server, 'POST', '/api/auth/register', {
    body: { email: 'agentui@syncspace.dev', password: 'password123', displayName: 'Agent UI' }
  })
  const created = await apiRequest<{ workspace: Workspace }>(server, 'POST', '/api/workspaces', { body: { name: 'Agents WS' } })
  workspaceId = created.body.workspace.id
}, 90_000)

afterAll(async () => {
  await server?.stop()
  await db?.stop()
})

describe('agent REST surface (frontend contract)', () => {
  it('lists the default agent roster for a workspace', async () => {
    const res = await apiRequest<{ agents: AgentProfile[] }>(server, 'GET', `/api/workspaces/${workspaceId}/agents`)
    expect(res.status).toBe(200)
    const slugs = res.body.agents.map((agent) => agent.slug).sort()
    expect(slugs).toEqual(['builder', 'doc', 'orchestrator', 'planner', 'reviewer'])
    res.body.agents.forEach((agent) => expect(agent.participantId).toBeTruthy())
  })

  it('invokes an agent and the worker drives the task to completion with an artifact', async () => {
    const agents = await apiRequest<{ agents: AgentProfile[] }>(server, 'GET', `/api/workspaces/${workspaceId}/agents`)
    const planner = agents.body.agents.find((agent) => agent.slug === 'planner')!

    const invoked = await apiRequest<{ task: { id: string; status: { state: string } } }>(
      server,
      'POST',
      `/api/agents/${planner.id}/invoke`,
      { body: { content: '@planner A2A 협업 구조를 설계해줘' } }
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

    const detail = await apiRequest<{ task: any; events: any[] }>(server, 'GET', `/api/tasks/${taskId}`)
    expect(detail.status).toBe(200)
    expect(detail.body.task.status.state).toBe('TASK_STATE_COMPLETED')
    expect(detail.body.task.artifacts.some((artifact: any) => artifact.artifactId === 'plan.md')).toBe(true)
    expect(detail.body.events.length).toBeGreaterThan(0)

    const list = await apiRequest<{ tasks: any[] }>(server, 'GET', `/api/workspaces/${workspaceId}/tasks`)
    expect(list.body.tasks.some((task) => task.id === taskId)).toBe(true)
  }, 30_000)

  it('does not expose agents of a workspace to non-members', async () => {
    const outsider = await startTestServer(db)
    await apiRequest(outsider, 'POST', '/api/auth/register', {
      body: { email: 'agentoutsider@syncspace.dev', password: 'password123' }
    })
    const res = await apiRequest(outsider, 'GET', `/api/workspaces/${workspaceId}/agents`)
    expect(res.status).toBe(404)
    await outsider.stop()
  })
})
