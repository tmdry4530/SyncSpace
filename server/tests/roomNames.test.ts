import { describe, expect, it } from 'vitest'
import { buildChatWebSocketPath, getChatRoomName } from '../src/routes/chatRoute.js'
import { buildDocWebSocketPath, getDocRoomName } from '../src/routes/docRoute.js'
import { parseRealtimeRequestUrl } from '../src/realtime/roomNames.js'

describe('room naming contract', () => {
  it('builds deterministic doc and chat room names', () => {
    expect(getDocRoomName('workspace-1', 'doc-1')).toBe('doc:workspace-1:doc-1')
    expect(getChatRoomName('workspace-1', 'channel-1')).toBe('chat:workspace-1:channel-1')
  })

  it('builds frontend-facing websocket paths', () => {
    expect(buildDocWebSocketPath('workspace-1', 'doc-1')).toBe('/doc/workspace-1/doc-1')
    expect(buildChatWebSocketPath('workspace-1', 'channel-1')).toBe('/chat/workspace-1/channel-1')
  })

  it('parses contract websocket URLs', () => {
    expect(parseRealtimeRequestUrl('/doc/workspace-1/doc-1')).toMatchObject({
      kind: 'doc',
      workspaceId: 'workspace-1',
      targetId: 'doc-1',
      roomName: 'doc:workspace-1:doc-1'
    })

    expect(parseRealtimeRequestUrl('/chat/workspace-1/channel-1')).toMatchObject({
      kind: 'chat',
      workspaceId: 'workspace-1',
      targetId: 'channel-1',
      roomName: 'chat:workspace-1:channel-1'
    })
  })

  it('parses y-websocket provider URLs that append the encoded room name', () => {
    expect(parseRealtimeRequestUrl('/doc/workspace-1/doc-1/doc%3Aworkspace-1%3Adoc-1')).toMatchObject({
      kind: 'doc',
      roomName: 'doc:workspace-1:doc-1'
    })
  })

  it('rejects mismatched appended room names', () => {
    expect(parseRealtimeRequestUrl('/doc/workspace-1/doc-1/doc%3Aworkspace-2%3Adoc-2')).toBeNull()
  })
})
