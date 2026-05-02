import { afterEach, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import WebSocket from 'ws'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import { readConfig } from '../src/config.js'
import { AllowAllRealtimeAuthorizer } from '../src/auth/realtimeAuth.js'
import { createSyncSpaceServer, type SyncSpaceServerHandle } from '../src/http/app.js'
import { NoopMessagePersistenceAdapter } from '../src/persistence/messagePersistence.js'
import { getChatRoomName } from '../src/routes/chatRoute.js'
import { getDocRoomName } from '../src/routes/docRoute.js'
import { silentLogger } from '../src/utils/logger.js'

let app: SyncSpaceServerHandle | null = null

afterEach(async () => {
  await app?.stop()
  app = null
})

describe('Yjs WebSocket rooms', () => {
  it('syncs document room updates through the contract URL', async () => {
    const address = await startTestServer()
    const room = getDocRoomName('workspace-1', 'doc-1')
    const url = `ws://127.0.0.1:${address.port}/doc/workspace-1/doc-1`
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    const providerA = createProvider(url, room, docA)
    const providerB = createProvider(url, room, docB)

    try {
      await Promise.all([waitForConnected(providerA), waitForConnected(providerB)])
      docA.getText('body').insert(0, 'Synced document')
      await waitFor(() => docB.getText('body').toString() === 'Synced document')
      expect(docB.getText('body').toString()).toBe('Synced document')
    } finally {
      providerA.destroy()
      providerB.destroy()
      docA.destroy()
      docB.destroy()
    }
  })

  it('restores document room state after every client disconnects', async () => {
    const address = await startTestServer()
    const room = getDocRoomName('workspace-1', 'doc-persist-1')
    const url = `ws://127.0.0.1:${address.port}/doc/workspace-1/doc-persist-1`

    const firstDoc = new Y.Doc()
    const firstProvider = createProvider(url, room, firstDoc)
    await waitForConnected(firstProvider)
    firstDoc.getText('body').insert(0, 'Restored document')
    await new Promise((resolve) => setTimeout(resolve, 500))
    firstProvider.destroy()
    firstDoc.destroy()

    const secondDoc = new Y.Doc()
    const secondProvider = createProvider(url, room, secondDoc)
    try {
      await waitForConnected(secondProvider)
      await waitFor(() => secondDoc.getText('body').toString() === 'Restored document')
      expect(secondDoc.getText('body').toString()).toBe('Restored document')
    } finally {
      secondProvider.destroy()
      secondDoc.destroy()
    }
  })

  it('syncs chat room Yjs updates and persists messages through the adapter', async () => {
    const adapter = new NoopMessagePersistenceAdapter()
    const address = await startTestServer(adapter)
    const room = getChatRoomName('workspace-1', 'channel-1')
    const url = `ws://127.0.0.1:${address.port}/chat/workspace-1/channel-1`
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    const providerA = createProvider(url, room, docA)
    const providerB = createProvider(url, room, docB)

    try {
      await Promise.all([waitForConnected(providerA), waitForConnected(providerB)])
      docA.getArray('messages').push([
        {
          id: '40000000-0000-0000-0000-000000000099',
          userId: '00000000-0000-0000-0000-000000000101',
          content: 'Hello realtime chat',
          clientId: 'integration-message-1',
          createdAt: '2026-05-01T08:02:00.000Z'
        }
      ])

      await waitFor(() => docB.getArray('messages').length === 1)
      await waitFor(() => adapter.messages.length === 1)
      expect(adapter.messages[0]).toMatchObject({ channelId: 'channel-1', content: 'Hello realtime chat' })
    } finally {
      providerA.destroy()
      providerB.destroy()
      docA.destroy()
      docB.destroy()
    }
  })
})

async function startTestServer(adapter = new NoopMessagePersistenceAdapter()): Promise<AddressInfo> {
  process.env.SYNCSPACE_DOC_PERSISTENCE_DIR = ''
  app = createSyncSpaceServer({
    config: readConfig({ PORT: '0', HOST: '127.0.0.1', ALLOWED_ORIGINS: '*', WS_AUTH_MODE: 'off', LOG_LEVEL: 'silent' }),
    logger: silentLogger,
    messagePersistence: adapter,
    authorizer: new AllowAllRealtimeAuthorizer()
  })
  return app.start()
}

function createProvider(url: string, room: string, doc: Y.Doc): WebsocketProvider {
  return new WebsocketProvider(url, room, doc, {
    WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    connect: true
  })
}

function waitForConnected(provider: WebsocketProvider): Promise<void> {
  if (provider.wsconnected) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      provider.off('status', onStatus)
      reject(new Error('Timed out waiting for websocket provider connection'))
    }, 5000)

    function onStatus(event: { status: string }): void {
      if (event.status === 'connected') {
        clearTimeout(timeout)
        provider.off('status', onStatus)
        resolve()
      }
    }

    provider.on('status', onStatus)
  })
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < 5000) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('Timed out waiting for condition')
}
