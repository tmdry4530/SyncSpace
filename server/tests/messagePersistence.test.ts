import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { NoopMessagePersistenceAdapter } from '../src/persistence/messagePersistence.js'
import { CHAT_MESSAGES_ARRAY, collectPersistableMessages, createChatRoomPersistenceHooks } from '../src/realtime/chatRoom.js'
import { silentLogger } from '../src/utils/logger.js'

describe('chat message persistence', () => {
  it('extracts contract-compatible messages from a Yjs chat room', () => {
    const ydoc = new Y.Doc()
    ydoc.getArray(CHAT_MESSAGES_ARRAY).push([
      {
        id: '40000000-0000-0000-0000-000000000010',
        userId: '00000000-0000-0000-0000-000000000101',
        content: 'Hello from Yjs',
        clientId: 'client-message-1',
        createdAt: '2026-05-01T08:00:00.000Z'
      },
      { content: 'invalid without user' }
    ])

    expect(collectPersistableMessages(ydoc, 'channel-1')).toEqual([
      {
        id: '40000000-0000-0000-0000-000000000010',
        channelId: 'channel-1',
        userId: '00000000-0000-0000-0000-000000000101',
        content: 'Hello from Yjs',
        clientId: 'client-message-1',
        createdAt: '2026-05-01T08:00:00.000Z'
      }
    ])
  })

  it('persists each Yjs chat message once per room', async () => {
    const ydoc = new Y.Doc()
    const adapter = new NoopMessagePersistenceAdapter()
    const hooks = createChatRoomPersistenceHooks(adapter, silentLogger, { debounceMs: 0 })

    ydoc.getArray(CHAT_MESSAGES_ARRAY).push([
      {
        id: '40000000-0000-0000-0000-000000000011',
        userId: '00000000-0000-0000-0000-000000000101',
        content: 'Persist once',
        clientId: 'client-message-2',
        createdAt: '2026-05-01T08:01:00.000Z'
      }
    ])

    await hooks.flush('chat:workspace-1:channel-1', ydoc)
    await hooks.flush('chat:workspace-1:channel-1', ydoc)

    expect(adapter.messages).toHaveLength(1)
    expect(adapter.messages[0]).toMatchObject({
      channelId: 'channel-1',
      content: 'Persist once',
      status: 'sent'
    })
  })

  it('paginates noop persisted messages by createdAt cursor', async () => {
    const adapter = new NoopMessagePersistenceAdapter()
    await adapter.persistMessage({ channelId: 'c1', userId: 'u1', content: 'first', createdAt: '2026-05-01T08:00:00.000Z' })
    await adapter.persistMessage({ channelId: 'c1', userId: 'u1', content: 'second', createdAt: '2026-05-01T08:01:00.000Z' })
    await adapter.persistMessage({ channelId: 'c1', userId: 'u1', content: 'third', createdAt: '2026-05-01T08:02:00.000Z' })

    const firstPage = await adapter.listMessages({ channelId: 'c1', limit: 2 })
    expect(firstPage.items.map((item) => item.content)).toEqual(['third', 'second'])
    expect(firstPage.nextCursor).toBe('2026-05-01T08:01:00.000Z')

    const secondPage = await adapter.listMessages({ channelId: 'c1', limit: 2, cursor: firstPage.nextCursor })
    expect(secondPage.items.map((item) => item.content)).toEqual(['first'])
    expect(secondPage.nextCursor).toBeNull()
  })
})
