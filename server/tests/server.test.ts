import { afterEach, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import { readConfig } from '../src/config.js'
import { AllowAllRealtimeAuthorizer } from '../src/auth/realtimeAuth.js'
import { createSyncSpaceServer, type SyncSpaceServerHandle } from '../src/http/app.js'
import { NoopMessagePersistenceAdapter } from '../src/persistence/messagePersistence.js'
import type { WorkspaceJoiner } from '../src/persistence/workspaceJoiner.js'
import { silentLogger } from '../src/utils/logger.js'

let app: SyncSpaceServerHandle | null = null

afterEach(async () => {
  await app?.stop()
  app = null
})

describe('SyncSpace HTTP server', () => {
  it('returns health with realtime stats', async () => {
    app = createSyncSpaceServer({
      config: readConfig({ PORT: '0', HOST: '127.0.0.1', ALLOWED_ORIGINS: '*', WS_AUTH_MODE: 'off', LOG_LEVEL: 'silent' }),
      logger: silentLogger,
      messagePersistence: new NoopMessagePersistenceAdapter(),
      authorizer: new AllowAllRealtimeAuthorizer()
    })

    const address = await app.start()
    const response = await fetch(`http://127.0.0.1:${address.port}/health`)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      service: 'syncspace-backend',
      realtime: {
        activeRooms: expect.any(Number),
        activeConnections: expect.any(Number),
        rooms: expect.any(Array)
      }
    })
  })

  it('rejects unknown routes with AppError shape', async () => {
    app = createSyncSpaceServer({
      config: readConfig({ PORT: '0', HOST: '127.0.0.1', ALLOWED_ORIGINS: '*', WS_AUTH_MODE: 'off', LOG_LEVEL: 'silent' }),
      logger: silentLogger,
      messagePersistence: new NoopMessagePersistenceAdapter(),
      authorizer: new AllowAllRealtimeAuthorizer()
    })

    const address = (await app.start()) as AddressInfo
    const response = await fetch(`http://127.0.0.1:${address.port}/missing`)
    await expect(response.json()).resolves.toEqual({ code: 'not_found', message: 'Route not found' })
    expect(response.status).toBe(404)
  })

  it('joins a workspace by invite code through the backend API', async () => {
    const workspaceJoiner: WorkspaceJoiner = {
      async joinByInviteCode(input) {
        expect(input).toEqual({ inviteCode: 'ABC123', accessToken: 'token-1' })
        return {
          id: 'workspace-1',
          name: 'Joined Workspace',
          ownerId: 'user-owner',
          inviteCode: 'ABC123',
          createdAt: '2026-05-01T00:00:00.000Z'
        }
      }
    }

    app = createSyncSpaceServer({
      config: readConfig({ PORT: '0', HOST: '127.0.0.1', ALLOWED_ORIGINS: '*', WS_AUTH_MODE: 'off', LOG_LEVEL: 'silent' }),
      logger: silentLogger,
      messagePersistence: new NoopMessagePersistenceAdapter(),
      workspaceJoiner,
      authorizer: new AllowAllRealtimeAuthorizer()
    })

    const address = (await app.start()) as AddressInfo
    const response = await fetch(`http://127.0.0.1:${address.port}/api/workspaces/join`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-1',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ inviteCode: 'ABC123' })
    })

    await expect(response.json()).resolves.toEqual({
      workspace: {
        id: 'workspace-1',
        name: 'Joined Workspace',
        ownerId: 'user-owner',
        inviteCode: 'ABC123',
        createdAt: '2026-05-01T00:00:00.000Z'
      }
    })
    expect(response.status).toBe(200)
  })

  it('requires auth for workspace invite joins', async () => {
    app = createSyncSpaceServer({
      config: readConfig({ PORT: '0', HOST: '127.0.0.1', ALLOWED_ORIGINS: '*', WS_AUTH_MODE: 'off', LOG_LEVEL: 'silent' }),
      logger: silentLogger,
      messagePersistence: new NoopMessagePersistenceAdapter(),
      workspaceJoiner: {
        async joinByInviteCode() {
          throw new Error('should not be called')
        }
      },
      authorizer: new AllowAllRealtimeAuthorizer()
    })

    const address = (await app.start()) as AddressInfo
    const response = await fetch(`http://127.0.0.1:${address.port}/api/workspaces/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inviteCode: 'ABC123' })
    })

    await expect(response.json()).resolves.toEqual({ code: 'missing_access_token', message: '로그인이 필요합니다.' })
    expect(response.status).toBe(401)
  })
})
