import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { isOriginAllowed, readConfig, type ServerConfig } from '../config.js'
import { createRealtimeAuthorizer, type RealtimeAuthorizer } from '../auth/realtimeAuth.js'
import { getAccessToken } from '../auth/realtimeAuth.js'
import { createMessagePersistenceAdapter, type MessagePersistenceAdapter } from '../persistence/messagePersistence.js'
import {
  createWorkspaceDeleter,
  WorkspaceDeleteError,
  type WorkspaceDeleter
} from '../persistence/workspaceDeleter.js'
import {
  createWorkspaceCreator,
  WorkspaceCreateError,
  type WorkspaceCreator
} from '../persistence/workspaceCreator.js'
import {
  createWorkspaceJoiner,
  WorkspaceJoinError,
  type WorkspaceJoiner
} from '../persistence/workspaceJoiner.js'
import { setupYWebsocketServer, type RealtimeServerHandle } from '../realtime/setupYWebsocket.js'
import { createLogger, type Logger } from '../utils/logger.js'

export interface SyncSpaceServerOptions {
  config?: ServerConfig
  logger?: Logger
  messagePersistence?: MessagePersistenceAdapter
  workspaceJoiner?: WorkspaceJoiner
  workspaceCreator?: WorkspaceCreator
  workspaceDeleter?: WorkspaceDeleter
  authorizer?: RealtimeAuthorizer
}

export interface SyncSpaceServerHandle {
  server: HttpServer
  realtime: RealtimeServerHandle
  config: ServerConfig
  start(): Promise<AddressInfo>
  stop(): Promise<void>
}

export function createSyncSpaceServer(options: SyncSpaceServerOptions = {}): SyncSpaceServerHandle {
  const config = options.config ?? readConfig()
  const logger = options.logger ?? createLogger(config.logLevel)
  const messagePersistence = options.messagePersistence ?? createMessagePersistenceAdapter(config, logger)
  const workspaceJoiner = options.workspaceJoiner ?? createWorkspaceJoiner(config, logger)
  const workspaceCreator = options.workspaceCreator ?? createWorkspaceCreator(config, logger)
  const workspaceDeleter = options.workspaceDeleter ?? createWorkspaceDeleter(config, logger)
  const authorizer = options.authorizer ?? createRealtimeAuthorizer(config, logger)

  let realtime: RealtimeServerHandle
  const server = createServer((request, response) => {
    void handleHttpRequest(request, response, () => realtime.stats(), config, workspaceJoiner, workspaceCreator, workspaceDeleter)
  })

  realtime = setupYWebsocketServer({
    server,
    config,
    logger,
    messagePersistence,
    authorizer
  })

  return {
    server,
    realtime,
    config,
    start: () =>
      new Promise<AddressInfo>((resolve, reject) => {
        server.once('error', reject)
        server.listen(config.port, config.host, () => {
          server.off('error', reject)
          const address = server.address()
          if (!address || typeof address === 'string') {
            reject(new Error('Server did not expose an address'))
            return
          }
          logger.info('SyncSpace backend listening', { host: config.host, port: address.port })
          resolve(address)
        })
      }),
    stop: async () => {
      await realtime.close()
      await new Promise<void>((resolve, reject) => {
        if (!server.listening) {
          resolve()
          return
        }
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    }
  }
}

type StatsProvider = () => unknown

async function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  stats: StatsProvider,
  config: ServerConfig,
  workspaceJoiner: WorkspaceJoiner,
  workspaceCreator: WorkspaceCreator,
  workspaceDeleter: WorkspaceDeleter
): Promise<void> {
  const pathname = getPathname(request.url)
  const headers = corsHeaders(request)

  if (request.headers.origin && !isOriginAllowed(request.headers.origin, config.allowedOrigins)) {
    writeJson(response, 403, { code: 'forbidden_origin', message: 'Origin is not allowed' }, headers)
    return
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, headers)
    response.end()
    return
  }

  if (request.method === 'GET' && pathname === '/health') {
    writeJson(response, 200, {
      ok: true,
      service: 'syncspace-backend',
      realtime: stats()
    }, headers)
    return
  }

  if (request.method === 'GET' && pathname === '/ready') {
    writeJson(response, 200, { ok: true }, headers)
    return
  }

  if (request.method === 'POST' && pathname === '/api/workspaces') {
    await handleCreateWorkspaceRequest(request, response, headers, workspaceCreator)
    return
  }

  const workspaceDeleteMatch = matchWorkspaceDeletePath(pathname)
  if (request.method === 'DELETE' && workspaceDeleteMatch) {
    await handleDeleteWorkspaceRequest(request, response, headers, workspaceDeleter, workspaceDeleteMatch.workspaceId)
    return
  }

  if (request.method === 'POST' && pathname === '/api/workspaces/join') {
    await handleJoinWorkspaceRequest(request, response, headers, workspaceJoiner)
    return
  }

  writeJson(response, 404, {
    code: 'not_found',
    message: 'Route not found'
  }, headers)
}

function getPathname(rawUrl: string | undefined): string {
  try {
    return new URL(rawUrl ?? '/', 'http://syncspace.local').pathname
  } catch {
    return '/'
  }
}

function matchWorkspaceDeletePath(pathname: string): { workspaceId: string } | null {
  const match = /^\/api\/workspaces\/([^/]+)$/.exec(pathname)
  return match?.[1] ? { workspaceId: decodePathSegment(match[1]) } : null
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

class HttpRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'HttpRequestError'
  }
}

function writeKnownError(response: ServerResponse, headers: Record<string, string>, error: unknown): boolean {
  if (error instanceof HttpRequestError) {
    writeJson(response, error.statusCode, { code: error.code, message: error.message }, headers)
    return true
  }
  if (error instanceof WorkspaceCreateError || error instanceof WorkspaceJoinError || error instanceof WorkspaceDeleteError) {
    writeJson(response, error.statusCode, { code: error.code, message: error.message }, headers)
    return true
  }
  return false
}

async function handleCreateWorkspaceRequest(
  request: IncomingMessage,
  response: ServerResponse,
  headers: Record<string, string>,
  workspaceCreator: WorkspaceCreator
): Promise<void> {
  try {
    const token = getAccessToken(request)
    if (!token) {
      writeJson(response, 401, { code: 'missing_access_token', message: '로그인이 필요합니다.' }, headers)
      return
    }

    const body = await readJsonBody(request)
    const name = typeof body.name === 'string' ? body.name : ''
    const workspace = await workspaceCreator.createWorkspace({ name, accessToken: token })
    writeJson(response, 200, { workspace }, headers)
  } catch (error) {
    if (writeKnownError(response, headers, error)) return
    writeJson(response, 500, { code: 'internal_error', message: '서버 요청 처리 중 문제가 발생했습니다.' }, headers)
  }
}

async function handleDeleteWorkspaceRequest(
  request: IncomingMessage,
  response: ServerResponse,
  headers: Record<string, string>,
  workspaceDeleter: WorkspaceDeleter,
  workspaceId: string
): Promise<void> {
  try {
    const token = getAccessToken(request)
    if (!token) {
      writeJson(response, 401, { code: 'missing_access_token', message: '로그인이 필요합니다.' }, headers)
      return
    }

    const deletedWorkspaceId = await workspaceDeleter.deleteWorkspace({ workspaceId, accessToken: token })
    writeJson(response, 200, { workspaceId: deletedWorkspaceId }, headers)
  } catch (error) {
    if (writeKnownError(response, headers, error)) return
    writeJson(response, 500, { code: 'internal_error', message: '서버 요청 처리 중 문제가 발생했습니다.' }, headers)
  }
}

async function handleJoinWorkspaceRequest(
  request: IncomingMessage,
  response: ServerResponse,
  headers: Record<string, string>,
  workspaceJoiner: WorkspaceJoiner
): Promise<void> {
  try {
    const token = getAccessToken(request)
    if (!token) {
      writeJson(response, 401, { code: 'missing_access_token', message: '로그인이 필요합니다.' }, headers)
      return
    }

    const body = await readJsonBody(request)
    const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode : ''
    const workspace = await workspaceJoiner.joinByInviteCode({ inviteCode, accessToken: token })
    writeJson(response, 200, { workspace }, headers)
  } catch (error) {
    if (writeKnownError(response, headers, error)) return
    writeJson(response, 500, { code: 'internal_error', message: '서버 요청 처리 중 문제가 발생했습니다.' }, headers)
  }
}

function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      body += chunk
      if (body.length > 64 * 1024) {
        reject(new HttpRequestError(413, 'payload_too_large', '요청 본문이 너무 큽니다.'))
        request.destroy()
      }
    })
    request.on('end', () => {
      if (!body.trim()) {
        resolve({})
        return
      }
      try {
        const parsed = JSON.parse(body)
        resolve(typeof parsed === 'object' && parsed !== null ? parsed : {})
      } catch {
        reject(new HttpRequestError(400, 'invalid_json', 'JSON 요청 본문이 올바르지 않습니다.'))
      }
    })
    request.on('error', reject)
  })
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown, headers: Record<string, string> = {}): void {
  response.writeHead(statusCode, {
    ...headers,
    'content-type': 'application/json; charset=utf-8'
  })
  response.end(JSON.stringify(body))
}

function corsHeaders(request: IncomingMessage): Record<string, string> {
  const origin = request.headers.origin
  return {
    ...(origin ? { 'access-control-allow-origin': origin } : {}),
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization'
  }
}
