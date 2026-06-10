import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { startTestServer, type TestServer } from './helpers/testServer.js'
import { registerAgentFixture } from './helpers/agentFixture.js'
import { createAgentToken } from '../src/db/repositories/agentRepository.js'
import { startJobRunner, type JobRunnerHandle } from '../src/workers/jobRunner.js'
import { processAgentTaskJob } from '../src/workers/agentTaskWorker.js'
import { createLogger } from '../src/utils/logger.js'

let db: EmbeddedDatabase
let server: TestServer
let worker: JobRunnerHandle
let token: string

const PEPPER = 'test-agent-pepper'

beforeAll(async () => {
  db = await startEmbeddedDatabase()
  server = await startTestServer(db)

  const reg = await registerAgentFixture({ displayName: 'Stream', slug: 'stream-owner' })
  token = (
    await createAgentToken({ agentId: reg.credential.agentId, scopes: ['task:read', 'task:write', 'task:cancel'], pepper: PEPPER })
  ).token

  // In-process worker so emitted events flow through Postgres NOTIFY to the SSE hub.
  worker = startJobRunner({
    logger: createLogger('silent'),
    workerId: 'test-worker',
    queues: [{ name: 'agent', handlers: { agent_task: (payload, deps) => processAgentTaskJob(payload, deps) } }],
    pollIntervalMs: 50
  })
  worker.start()
}, 90_000)

afterAll(async () => {
  await worker?.stop()
  await server?.stop()
  await db?.stop()
})

async function readSseUntilTerminal(path: string, body: unknown, timeoutMs = 20_000): Promise<{ events: { name: string; data: any }[] }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const response = await fetch(`${server.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'a2a-version': '1.0', 'content-type': 'application/a2a+json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: controller.signal
  })
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  const events: { name: string; data: any }[] = []
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''
      for (const frame of frames) {
        const nameLine = frame.split('\n').find((line) => line.startsWith('event: '))
        const dataLine = frame.split('\n').find((line) => line.startsWith('data: '))
        if (!nameLine || !dataLine) continue
        const name = nameLine.slice('event: '.length)
        const data = JSON.parse(dataLine.slice('data: '.length))
        events.push({ name, data })
        if (data.statusUpdate?.final) {
          return { events }
        }
      }
    }
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
  return { events }
}

describe('A2A streaming + worker end-to-end', () => {
  it('message:stream emits Task, status, artifact updates, and closes on terminal', async () => {
    const { events } = await readSseUntilTerminal('/a2a/message:stream', {
      message: { messageId: 'stream-1', role: 'ROLE_USER', parts: [{ text: 'Plan the feature' }] }
    })

    const names = events.map((event) => event.name)
    expect(names).toContain('message') // initial task snapshot
    expect(names).toContain('statusUpdate')
    expect(names).toContain('artifactUpdate')

    const finalStatus = events.find((event) => event.data.statusUpdate?.final)
    expect(finalStatus?.data.statusUpdate.status.state).toBe('TASK_STATE_COMPLETED')

    const artifactEvent = events.find((event) => event.name === 'artifactUpdate')
    expect(artifactEvent?.data.artifactUpdate.artifact.artifactId).toBe('plan.md')
  }, 30_000)
})
