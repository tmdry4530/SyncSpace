import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { startTestServer, type TestServer } from './helpers/testServer.js'
import { registerAgentFixture } from './helpers/agentFixture.js'
import { createAgentToken } from '../src/db/repositories/agentRepository.js'
import { startJobRunner } from '../src/workers/jobRunner.js'
import { processAgentTaskJob } from '../src/workers/agentTaskWorker.js'
import { processPushJob } from '../src/workers/pushNotificationWorker.js'
import { createLogger } from '../src/utils/logger.js'

let db: EmbeddedDatabase
let server: TestServer
let token: string
const PEPPER = 'test-agent-pepper'

interface Receiver {
  server: Server
  url: string
  requests: { body: any; idempotencyKey: string | null }[]
  status: number
  close(): Promise<void>
}

async function startReceiver(status = 200): Promise<Receiver> {
  const requests: Receiver['requests'] = []
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      try {
        requests.push({ body: body ? JSON.parse(body) : null, idempotencyKey: (req.headers['x-a2a-idempotency-key'] as string) ?? null })
      } catch {
        requests.push({ body: null, idempotencyKey: null })
      }
      res.writeHead(receiver.status)
      res.end()
    })
  })
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  const address = httpServer.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const receiver: Receiver = {
    server: httpServer,
    url: `http://127.0.0.1:${port}/hook`,
    requests,
    status,
    close: () => new Promise((resolve) => httpServer.close(() => resolve()))
  }
  return receiver
}

async function a2a(method: string, path: string, body?: unknown, useToken = true) {
  const headers: Record<string, string> = { 'a2a-version': '1.0' }
  if (body !== undefined) headers['content-type'] = 'application/a2a+json'
  if (useToken) headers.authorization = `Bearer ${token}`
  const response = await fetch(`${server.baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

async function newTaskId(messageId: string): Promise<string> {
  const res = await a2a('POST', '/a2a/message:send', {
    message: { messageId, role: 'ROLE_USER', parts: [{ text: 'do it' }] }
  })
  return res.body.task.id
}

beforeAll(async () => {
  db = await startEmbeddedDatabase()
  server = await startTestServer(db)
  const reg = await registerAgentFixture({ displayName: 'Push', slug: 'push-owner' })
  token = (
    await createAgentToken({ agentId: reg.credential.agentId, scopes: ['task:read', 'task:write', 'push:write'], pepper: PEPPER })
  ).token
}, 90_000)

afterAll(async () => {
  await server?.stop()
  await db?.stop()
})

function drainRunner() {
  return startJobRunner({
    logger: createLogger('silent'),
    workerId: 'push-test-worker',
    queues: [
      { name: 'agent', handlers: { agent_task: (p, d) => processAgentTaskJob(p, d) } },
      { name: 'push', handlers: { push_delivery: (p, d) => processPushJob(p, d) } }
    ]
  })
}

describe('A2A push notifications', () => {
  it('rejects a private/SSRF webhook target', async () => {
    delete process.env.A2A_ALLOW_INSECURE_WEBHOOKS
    const taskId = await newTaskId('push-ssrf')
    const res = await a2a('POST', `/a2a/tasks/${taskId}/pushNotificationConfigs`, {
      pushNotificationConfig: { url: 'https://10.0.0.1/hook' }
    })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('blocked_webhook_target')
  })

  it('supports config CRUD and delivers a webhook at-least-once', async () => {
    process.env.A2A_ALLOW_INSECURE_WEBHOOKS = 'true'
    const receiver = await startReceiver(200)
    try {
      const taskId = await newTaskId('push-deliver')
      const created = await a2a('POST', `/a2a/tasks/${taskId}/pushNotificationConfigs`, {
        pushNotificationConfig: { url: receiver.url, token: 'secret-token' }
      })
      expect(created.status).toBe(200)
      const configId = created.body.pushNotificationConfig.id

      const list = await a2a('GET', `/a2a/tasks/${taskId}/pushNotificationConfigs`)
      expect(list.body.pushNotificationConfigs.length).toBe(1)

      const got = await a2a('GET', `/a2a/tasks/${taskId}/pushNotificationConfigs/${configId}`)
      expect(got.status).toBe(200)

      const runner = drainRunner()
      await runner.drainOnce() // agent_task -> status changes -> push jobs
      await runner.drainOnce() // deliver any push jobs enqueued during the agent run
      await runner.stop()

      expect(receiver.requests.length).toBeGreaterThan(0)
      expect(receiver.requests[0]?.body.task).toBeTruthy()
      expect(receiver.requests[0]?.idempotencyKey).toBeTruthy()

      const del = await a2a('DELETE', `/a2a/tasks/${taskId}/pushNotificationConfigs/${configId}`)
      expect(del.status).toBe(204)
    } finally {
      await receiver.close()
      delete process.env.A2A_ALLOW_INSECURE_WEBHOOKS
    }
  }, 30_000)

  it('retries delivery on a 5xx response', async () => {
    process.env.A2A_ALLOW_INSECURE_WEBHOOKS = 'true'
    const receiver = await startReceiver(500)
    try {
      const taskId = await newTaskId('push-retry')
      const created = await a2a('POST', `/a2a/tasks/${taskId}/pushNotificationConfigs`, {
        pushNotificationConfig: { url: receiver.url }
      })
      const configId = created.body.pushNotificationConfig.id

      const runner = drainRunner()
      await runner.drainOnce()
      await runner.drainOnce()
      await runner.stop()

      const jobs = await db.pool.query<{ status: string; attempts: number; last_error: string | null }>(
        `select status, attempts, last_error from jobs where queue_name = 'push' and payload->>'configId' = $1 order by created_at desc limit 1`,
        [configId]
      )
      expect(jobs.rows[0]?.status).toBe('queued') // rescheduled for retry
      expect(jobs.rows[0]?.attempts).toBeGreaterThanOrEqual(1)
      expect(jobs.rows[0]?.last_error).toBeTruthy()
    } finally {
      await receiver.close()
      delete process.env.A2A_ALLOW_INSECURE_WEBHOOKS
    }
  }, 30_000)
})
