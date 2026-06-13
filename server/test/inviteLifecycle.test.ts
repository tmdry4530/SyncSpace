import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { apiRequest, bearer, startTestServer, type TestServer } from './helpers/testServer.js'
import { registerAgentFixture } from './helpers/agentFixture.js'
import { getWorkspaceById } from '../src/db/repositories/workspaceRepository.js'

/**
 * Invite-code lifecycle (#13).
 *
 *  - rotate changes the code
 *  - the OLD code no longer resolves on POST /api/workspaces/join (400)
 *  - the NEW code works
 *  - an expired code is rejected (400)
 *  - double-join is idempotent (one workspace_members row)
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

async function currentInviteCode(workspaceId: string): Promise<string> {
  const ws = await getWorkspaceById(workspaceId)
  if (!ws) throw new Error('workspace missing')
  return ws.inviteCode
}

describe('invite-code lifecycle', () => {
  it('rotation invalidates the old code and the new code resolves', async () => {
    const owner = await registerAgentFixture({ displayName: 'Rotate Owner', slug: 'rotate-owner' })
    const workspaceId = owner.identity.workspaceId
    const oldCode = await currentInviteCode(workspaceId)

    const rotate = await apiRequest<{ inviteCode: string }>(
      server,
      'POST',
      `/api/workspaces/${workspaceId}/invite-code/rotate`,
      { useCookies: false, headers: bearer(owner.credential.secret) }
    )
    expect(rotate.status).toBe(200)
    const newCode = rotate.body.inviteCode
    expect(newCode).toBeTruthy()
    expect(newCode).not.toBe(oldCode)
    expect(newCode).toHaveLength(10)
    // Persisted as the workspace's code.
    expect(await currentInviteCode(workspaceId)).toBe(newCode)

    // A joiner with a fresh identity tries the OLD code → 400 invalid_invite_code.
    const joiner = await registerAgentFixture({ displayName: 'Joiner One', slug: 'joiner-one' })
    const staleJoin = await apiRequest<{ code: string }>(server, 'POST', '/api/workspaces/join', {
      useCookies: false,
      headers: bearer(joiner.credential.secret),
      body: { inviteCode: oldCode }
    })
    expect(staleJoin.status).toBe(400)
    expect(staleJoin.body.code).toBe('invalid_invite_code')

    // The NEW code works.
    const freshJoin = await apiRequest<{ workspace: { id: string } }>(server, 'POST', '/api/workspaces/join', {
      useCookies: false,
      headers: bearer(joiner.credential.secret),
      body: { inviteCode: newCode }
    })
    expect(freshJoin.status).toBe(200)
    expect(freshJoin.body.workspace.id).toBe(workspaceId)
  })

  it('rejects an expired invite code', async () => {
    const owner = await registerAgentFixture({ displayName: 'Expiry Owner', slug: 'expiry-owner' })
    const workspaceId = owner.identity.workspaceId
    const code = await currentInviteCode(workspaceId)

    // Force the code into the past via the shared pool.
    await db.pool.query(
      `update workspaces set invite_code_expires_at = now() - interval '1 hour' where id = $1`,
      [workspaceId]
    )

    const joiner = await registerAgentFixture({ displayName: 'Joiner Two', slug: 'joiner-two' })
    const expiredJoin = await apiRequest<{ code: string }>(server, 'POST', '/api/workspaces/join', {
      useCookies: false,
      headers: bearer(joiner.credential.secret),
      body: { inviteCode: code }
    })
    expect(expiredJoin.status).toBe(400)
    expect(expiredJoin.body.code).toBe('invalid_invite_code')
  })

  it('double-join is idempotent (one workspace_members row)', async () => {
    const owner = await registerAgentFixture({ displayName: 'Idem Owner', slug: 'idem-owner' })
    const workspaceId = owner.identity.workspaceId
    const code = await currentInviteCode(workspaceId)

    const joiner = await registerAgentFixture({ displayName: 'Joiner Three', slug: 'joiner-three' })
    const headers = bearer(joiner.credential.secret)

    const first = await apiRequest(server, 'POST', '/api/workspaces/join', {
      useCookies: false,
      headers,
      body: { inviteCode: code }
    })
    expect(first.status).toBe(200)

    const second = await apiRequest(server, 'POST', '/api/workspaces/join', {
      useCookies: false,
      headers,
      body: { inviteCode: code }
    })
    expect(second.status).toBe(200)

    const rows = await db.pool.query<{ count: string }>(
      `select count(*)::text as count from workspace_members where workspace_id = $1 and participant_id = $2`,
      [workspaceId, joiner.identity.participantId]
    )
    expect(rows.rows[0]?.count).toBe('1')
  })
})
