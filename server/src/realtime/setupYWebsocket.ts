import type { IncomingMessage, Server as HttpServer } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, type WebSocket } from 'ws'
import type * as Y from 'yjs'
import { docs, setPersistence, setupWSConnection } from '@y/websocket-server/utils'
import { isOriginAllowed, type ServerConfig } from '../config.js'
import type { RealtimeAuthorizer } from '../auth/realtimeAuth.js'
import type { MessagePersistenceAdapter } from '../persistence/messagePersistence.js'
import type { Logger } from '../utils/logger.js'
import { createChatRoomPersistenceHooks } from './chatRoom.js'
import { createDocRoomPersistenceHooks } from './docPersistence.js'
import { parseRealtimeRequestUrl, type RealtimeRoute } from './roomNames.js'

export interface RealtimeStats {
  activeRooms: number
  activeConnections: number
  rooms: string[]
}

export interface SetupYWebsocketOptions {
  server: HttpServer
  config: ServerConfig
  logger: Logger
  messagePersistence: MessagePersistenceAdapter
  authorizer: RealtimeAuthorizer
}

export interface RealtimeServerHandle {
  wss: WebSocketServer
  stats(): RealtimeStats
  close(): Promise<void>
}

type RequestWithRoute = IncomingMessage & { syncSpaceRoute?: RealtimeRoute }

type YDocWithConnections = Y.Doc & { conns?: Map<unknown, unknown> }

export function setupYWebsocketServer(options: SetupYWebsocketOptions): RealtimeServerHandle {
  const { server, config, logger, messagePersistence, authorizer } = options
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    handleProtocols: (protocols) => (protocols.has('bearer') ? 'bearer' : false)
  })
  const chatPersistence = createChatRoomPersistenceHooks(messagePersistence, logger)
  const docPersistence = createDocRoomPersistenceHooks(logger)

  setPersistence({
    provider: null,
    bindState: (docName: string, ydoc: Y.Doc) => {
      chatPersistence.bind(docName, ydoc)
      docPersistence.bind(docName, ydoc)
    },
    writeState: async (docName: string, ydoc: Y.Doc) => {
      await chatPersistence.flush(docName, ydoc)
      await docPersistence.flush(docName, ydoc)
    }
  })

  server.on('upgrade', (request, socket, head) => {
    void handleUpgrade(request, socket, head)
  })

  wss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
    const route = (request as RequestWithRoute).syncSpaceRoute
    if (!route) {
      socket.close(1008, 'missing route')
      return
    }

    socket.on('error', (error) => {
      logger.warn('WebSocket connection error', { roomName: route.roomName, error: error.message })
    })

    try {
      setupWSConnection(socket, request, { docName: route.roomName })
      logger.debug('Realtime client connected', { roomName: route.roomName, kind: route.kind })
    } catch (error) {
      logger.error('Failed to set up Yjs WebSocket connection', {
        roomName: route.roomName,
        error: error instanceof Error ? error.message : String(error)
      })
      socket.close(1011, 'failed to set up room')
    }
  })

  async function handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const route = parseRealtimeRequestUrl(request.url)
    if (!route) {
      rejectUpgrade(socket, 404, 'Not Found')
      return
    }

    if (!isOriginAllowed(request.headers.origin, config.allowedOrigins)) {
      rejectUpgrade(socket, 403, 'Forbidden')
      return
    }

    const auth = await authorizer.authorize({ request, route })
    if (!auth.ok) {
      rejectUpgrade(socket, 401, 'Unauthorized')
      return
    }

    ;(request as RequestWithRoute).syncSpaceRoute = route
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  }

  return {
    wss,
    stats: getRealtimeStats,
    close: () =>
      new Promise<void>((resolve, reject) => {
        wss.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
  }
}

export function getRealtimeStats(): RealtimeStats {
  const roomDocs = docs as unknown as Map<string, YDocWithConnections>
  const rooms = Array.from(roomDocs.keys()).sort()
  const activeConnections = Array.from(roomDocs.values()).reduce((total, doc) => total + (doc.conns?.size ?? 0), 0)
  return {
    activeRooms: rooms.length,
    activeConnections,
    rooms
  }
}

function rejectUpgrade(socket: Duplex, statusCode: number, reason: string): void {
  socket.write(`HTTP/1.1 ${statusCode} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
  socket.destroy()
}
