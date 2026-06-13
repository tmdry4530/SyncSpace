import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { apiRequest, bearer, startTestServer, type TestServer } from './helpers/testServer.js'
import { solveChallengePrompt } from '../src/auth/challenge.js'
import type { AgentRegistrationResult } from '../src/types/contracts.js'

/**
 * Multi-workspace membership: one identity (credential) can JOIN other
 * workspaces under its own participant and then READ them — the foundation for
 * the workspace-switcher dropdown. Authorization is membership-based
 * (home workspace OR a workspace_members row), and the cross-workspace IDOR
 * boundary (404 for non-members) is preserved.
 */

let db: EmbeddedDatabase
let server: TestServer

beforeAll(async () => {
  db = await startEmbeddedDatabase()
  server = await startTestServer(db)
}, 90_000)

afterAll(async () => {
  await server?.stop()
  await db?.stop()
})

interface Challenge {
  challengeId: string
  prompt: string
  expiresAt: string
}

async function register(displayName: string, slug: string): Promise<AgentRegistrationResult> {
  const ch = await apiRequest<Challenge>(server, 'POST', '/api/agents/register/challenge', { useCookies: false })
  expect(ch.status).toBe(200)
  const answer = solveChallengePrompt(ch.body.prompt)
  const res = await apiRequest<AgentRegistrationResult>(server, 'POST', '/api/agents/register', {
    body: { challengeId: ch.body.challengeId, answer, displayName, slug },
    useCookies: false
  })
  expect(res.status).toBe(200)
  return res.body
}

describe('multi-workspace membership join', () => {
  let a: AgentRegistrationResult
  let b: AgentRegistrationResult
  let c: AgentRegistrationResult

  beforeAll(async () => {
    a = await register('Agent A', 'agent-a')
    b = await register('Agent B', 'agent-b')
    c = await register('Agent C', 'agent-c')
  }, 60_000)

  it('before joining, A cannot read B’s workspace (404 IDOR boundary)', async () => {
    const res = await apiRequest(server, 'GET', `/api/workspaces/${b.workspace.id}/channels`, {
      useCookies: false,
      headers: bearer(a.credential.secret)
    })
    expect(res.status).toBe(404)
  })

  it('A joins B’s workspace by invite code under its own identity', async () => {
    const res = await apiRequest<{ workspace: { id: string } }>(server, 'POST', '/api/workspaces/join', {
      body: { inviteCode: b.workspace.inviteCode },
      useCookies: false,
      headers: bearer(a.credential.secret)
    })
    expect(res.status).toBe(200)
    expect(res.body.workspace.id).toBe(b.workspace.id)

    // The join reuses A's participant (no new credential): A's identity is now a
    // member of B's workspace.
    const member = await db.pool.query<{ role: string }>(
      `select role from workspace_members where workspace_id = $1 and participant_id = $2`,
      [b.workspace.id, a.identity.participantId]
    )
    expect(member.rows[0]?.role).toBe('member')
  })

  it('GET /api/workspaces now returns BOTH workspaces for A', async () => {
    const res = await apiRequest<{ workspaces: { id: string }[] }>(server, 'GET', '/api/workspaces', {
      useCookies: false,
      headers: bearer(a.credential.secret)
    })
    expect(res.status).toBe(200)
    const ids = res.body.workspaces.map((w) => w.id)
    expect(ids).toContain(a.workspace.id)
    expect(ids).toContain(b.workspace.id)
  })

  it('A can now READ B’s workspace via membership authorization', async () => {
    const channels = await apiRequest(server, 'GET', `/api/workspaces/${b.workspace.id}/channels`, {
      useCookies: false,
      headers: bearer(a.credential.secret)
    })
    expect(channels.status).toBe(200)
    const participants = await apiRequest(server, 'GET', `/api/workspaces/${b.workspace.id}/participants`, {
      useCookies: false,
      headers: bearer(a.credential.secret)
    })
    expect(participants.status).toBe(200)
  })

  it('a non-member (C) still gets 404 for B’s workspace (IDOR preserved)', async () => {
    const res = await apiRequest(server, 'GET', `/api/workspaces/${b.workspace.id}/channels`, {
      useCookies: false,
      headers: bearer(c.credential.secret)
    })
    expect(res.status).toBe(404)
  })

  it('an unknown invite code is rejected with 400', async () => {
    const res = await apiRequest<{ code: string }>(server, 'POST', '/api/workspaces/join', {
      body: { inviteCode: 'ZZZZ000000' },
      useCookies: false,
      headers: bearer(a.credential.secret)
    })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('invalid_invite_code')
  })

  it('joining requires authentication', async () => {
    const res = await apiRequest(server, 'POST', '/api/workspaces/join', {
      body: { inviteCode: b.workspace.inviteCode },
      useCookies: false
    })
    expect(res.status).toBe(401)
  })
})
