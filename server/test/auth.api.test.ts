import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { apiRequest, startTestServer, type TestServer } from './helpers/testServer.js'
import { solveChallengePrompt } from '../src/auth/challenge.js'
import type { AgentRegistrationResult, AuthAgentIdentity } from '../src/types/contracts.js'

let db: EmbeddedDatabase
let server: TestServer
// The primary agent registered in the first test; reused by later tests so the
// per-IP registration rate limiter (5/min) is not exhausted.
let primary: AgentRegistrationResult

beforeAll(async () => {
  db = await startEmbeddedDatabase()
  server = await startTestServer(db)
}, 90_000)

afterAll(async () => {
  await server?.stop()
  await db?.stop()
})

interface ChallengeResponse {
  challengeId: string
  prompt: string
  expiresAt: string
}

async function requestChallenge(): Promise<ChallengeResponse> {
  const res = await apiRequest<ChallengeResponse>(server, 'POST', '/api/agents/register/challenge', {
    useCookies: false
  })
  expect(res.status).toBe(200)
  return res.body
}

describe('agent registration + auth surface', () => {
  it('registers an agent with the correct challenge answer and returns a one-time secret', async () => {
    const challenge = await requestChallenge()
    const answer = solveChallengePrompt(challenge.prompt)

    const registered = await apiRequest<AgentRegistrationResult>(server, 'POST', '/api/agents/register', {
      body: { challengeId: challenge.challengeId, answer, displayName: 'Ada Agent', slug: 'ada-agent', role: 'planner' }
    })
    expect(registered.status).toBe(200)
    expect(registered.body.credential.secret).toBeTruthy()
    expect(registered.body.credential.agentId).toBeTruthy()
    expect(registered.body.identity.slug).toBe('ada-agent')
    expect(registered.body.workspace.ownerParticipantId).toBe(registered.body.identity.participantId)
    primary = registered.body

    // The register response sets the session cookie -> /api/auth/me resolves the identity.
    const me = await apiRequest<{ identity: AuthAgentIdentity | null }>(server, 'GET', '/api/auth/me')
    expect(me.body.identity?.agentId).toBe(registered.body.credential.agentId)
  })

  it('rejects a wrong challenge answer with 422 challenge_failed (반려)', async () => {
    const challenge = await requestChallenge()
    const rejected = await apiRequest<{ code: string }>(server, 'POST', '/api/agents/register', {
      body: { challengeId: challenge.challengeId, answer: 'definitely-wrong', displayName: 'Nope' },
      useCookies: false
    })
    expect(rejected.status).toBe(422)
    expect(rejected.body.code).toBe('challenge_failed')
  })

  it('rejects a reused or already-consumed challenge with 400', async () => {
    const challenge = await requestChallenge()
    const answer = solveChallengePrompt(challenge.prompt)

    const first = await apiRequest<AgentRegistrationResult>(server, 'POST', '/api/agents/register', {
      body: { challengeId: challenge.challengeId, answer, displayName: 'First Use' },
      useCookies: false
    })
    expect(first.status).toBe(200)

    const reuse = await apiRequest<{ code: string }>(server, 'POST', '/api/agents/register', {
      body: { challengeId: challenge.challengeId, answer, displayName: 'Reuse' },
      useCookies: false
    })
    expect(reuse.status).toBe(400)
    expect(reuse.body.code).toBe('challenge_expired')
  })

  it('agent-login with the secret sets a session cookie; bad credentials are 401', async () => {
    const { agentId, secret } = primary.credential

    const login = await apiRequest<{ identity: AuthAgentIdentity }>(server, 'POST', '/api/auth/agent-login', {
      body: { agentId, secret }
    })
    expect(login.status).toBe(200)
    expect(login.body.identity.agentId).toBe(agentId)

    const me = await apiRequest<{ identity: AuthAgentIdentity | null }>(server, 'GET', '/api/auth/me')
    expect(me.body.identity?.agentId).toBe(agentId)

    const bad = await apiRequest<{ code: string }>(server, 'POST', '/api/auth/agent-login', {
      body: { agentId, secret: 'not-the-secret' },
      useCookies: false
    })
    expect(bad.status).toBe(401)
  })

  it('requires authentication for protected routes', async () => {
    const anon = await apiRequest(server, 'GET', '/api/workspaces', { useCookies: false })
    expect(anon.status).toBe(401)
  })

  it('authorizes protected routes via a Bearer secret', async () => {
    const { secret } = primary.credential
    const workspaceId = primary.identity.workspaceId

    const list = await apiRequest<{ workspaces: { id: string }[] }>(server, 'GET', '/api/workspaces', {
      useCookies: false,
      headers: { authorization: `Bearer ${secret}` }
    })
    expect(list.status).toBe(200)
    expect(list.body.workspaces.some((w) => w.id === workspaceId)).toBe(true)
  })

  it('exposes registration availability without auth', async () => {
    const res = await apiRequest<{ internalEnabled: boolean; externalEnabled: boolean }>(
      server,
      'GET',
      '/api/auth/registration-config',
      { useCookies: false }
    )
    expect(res.status).toBe(200)
    expect(typeof res.body.internalEnabled).toBe('boolean')
    expect(typeof res.body.externalEnabled).toBe('boolean')
    // Test config runs with nodeEnv !== 'production', so both paths are open.
    expect(res.body.internalEnabled).toBe(true)
    expect(res.body.externalEnabled).toBe(true)
    // Nothing beyond the two booleans should leak.
    expect(Object.keys(res.body).sort()).toEqual(['externalEnabled', 'internalEnabled'])
  })

  it('logs out and clears the session cookie', async () => {
    await apiRequest(server, 'POST', '/api/auth/logout')
    const me = await apiRequest<{ identity: AuthAgentIdentity | null }>(server, 'GET', '/api/auth/me')
    expect(me.body.identity).toBeNull()
  })
})
