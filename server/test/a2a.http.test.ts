import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { startTestServer, type TestServer } from './helpers/testServer.js'
import { registerAgentFixture } from './helpers/agentFixture.js'
import { createAgentToken } from '../src/db/repositories/agentRepository.js'

let db: EmbeddedDatabase
let server: TestServer
let token: string
let otherToken: string

const PEPPER = 'test-agent-pepper'

interface A2aResponse {
  status: number
  body: any
  headers: Headers
}

async function a2a(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; version?: string; contentType?: string; omitVersion?: boolean } = {}
): Promise<A2aResponse> {
  const headers: Record<string, string> = {}
  if (!opts.omitVersion) headers['a2a-version'] = opts.version ?? '1.0'
  if (opts.body !== undefined) headers['content-type'] = opts.contentType ?? 'application/a2a+json'
  if (opts.token) headers.authorization = `Bearer ${opts.token}`
  const response = await fetch(`${server.baseUrl}${path}`, {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {})
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined, headers: response.headers }
}

beforeAll(async () => {
  db = await startEmbeddedDatabase()
  server = await startTestServer(db)

  const mine = await registerAgentFixture({ displayName: 'Owner', slug: 'http-owner' })
  token = (
    await createAgentToken({
      agentId: mine.credential.agentId,
      scopes: ['task:read', 'task:write', 'task:cancel', 'push:write'],
      pepper: PEPPER
    })
  ).token

  const other = await registerAgentFixture({ displayName: 'Other', slug: 'http-other' })
  otherToken = (
    await createAgentToken({ agentId: other.credential.agentId, scopes: ['task:read', 'task:write'], pepper: PEPPER })
  ).token
}, 90_000)

afterAll(async () => {
  await server?.stop()
  await db?.stop()
})

const sendBody = (messageId: string, contextId?: string) => ({
  message: { messageId, role: 'ROLE_USER', parts: [{ text: 'Plan this feature' }], ...(contextId ? { contextId } : {}) }
})

describe('A2A HTTP conformance', () => {
  it('serves the public Agent Card with supportedInterfaces + ETag', async () => {
    const res = await a2a('GET', '/.well-known/agent-card.json')
    expect(res.status).toBe(200)
    expect(res.body.name).toBeTruthy()
    expect(res.body.supportedInterfaces[0].protocolBinding).toBe('HTTP+JSON')
    expect(res.body.capabilities.streaming).toBe(true)
    expect(res.headers.get('etag')).toBeTruthy()
  })

  it('rejects an unsupported A2A-Version', async () => {
    const res = await a2a('POST', '/a2a/message:send', { token, body: sendBody('v-1'), version: '9.9' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('unsupported_version')
    expect(res.headers.get('content-type')).toContain('application/problem+json')
  })

  it('rejects an unsupported Content-Type with 415', async () => {
    const res = await a2a('POST', '/a2a/message:send', { token, body: sendBody('ct-1'), contentType: 'text/plain' })
    expect(res.status).toBe(415)
    expect(res.body.code).toBe('unsupported_media_type')
  })

  it('requires authentication', async () => {
    const res = await a2a('POST', '/a2a/message:send', { body: sendBody('noauth-1') })
    expect(res.status).toBe(401)
  })

  it('message:send creates a Task in SUBMITTED', async () => {
    const res = await a2a('POST', '/a2a/message:send', { token, body: sendBody('send-1') })
    expect(res.status).toBe(200)
    expect(res.body.task.status.state).toBe('TASK_STATE_SUBMITTED')
    expect(res.body.task.contextId).toBeTruthy()
  })

  it('is idempotent on duplicate messageId within a context', async () => {
    const first = await a2a('POST', '/a2a/message:send', { token, body: sendBody('idem-1') })
    const contextId = first.body.task.contextId
    const second = await a2a('POST', '/a2a/message:send', { token, body: sendBody('idem-1', contextId) })
    expect(second.body.task.id).toBe(first.body.task.id)
  })

  it('GET task is authorized to the owning workspace and does not leak to others', async () => {
    const created = await a2a('POST', '/a2a/message:send', { token, body: sendBody('get-1') })
    const taskId = created.body.task.id

    const mine = await a2a('GET', `/a2a/tasks/${taskId}`, { token })
    expect(mine.status).toBe(200)
    expect(mine.body.task.id).toBe(taskId)

    const leak = await a2a('GET', `/a2a/tasks/${taskId}`, { token: otherToken })
    expect(leak.status).toBe(404)
  })

  it('lists tasks with cursor pagination', async () => {
    const list = await a2a('GET', '/a2a/tasks?pageSize=2', { token })
    expect(list.status).toBe(200)
    expect(Array.isArray(list.body.tasks)).toBe(true)
    expect(list.body.tasks.length).toBeGreaterThan(0)
  })

  it('cancel is idempotent', async () => {
    const created = await a2a('POST', '/a2a/message:send', { token, body: sendBody('cancel-1') })
    const taskId = created.body.task.id
    const first = await a2a('POST', `/a2a/tasks/${taskId}:cancel`, { token })
    expect(first.status).toBe(200)
    expect(first.body.task.status.state).toBe('TASK_STATE_CANCELED')
    const again = await a2a('POST', `/a2a/tasks/${taskId}:cancel`, { token })
    expect(again.body.task.status.state).toBe('TASK_STATE_CANCELED')
  })

  it('extendedAgentCard requires auth', async () => {
    const anon = await a2a('GET', '/a2a/extendedAgentCard')
    expect(anon.status).toBe(401)
    const authed = await a2a('GET', '/a2a/extendedAgentCard', { token })
    expect(authed.status).toBe(200)
    expect(authed.body.extended.agentRoles).toContain('planner')
  })
})
