import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRequestOriginAllowed, readConfig, type ServerConfig } from '../config.js'
import { createRealtimeAuthorizer, type RealtimeAuthorizer } from '../auth/realtimeAuth.js'
import { createMessagePersistenceAdapter, type MessagePersistenceAdapter } from '../persistence/messagePersistence.js'
import { setupYWebsocketServer, type RealtimeServerHandle } from '../realtime/setupYWebsocket.js'
import { createLogger, type Logger } from '../utils/logger.js'
import { closePool } from '../db/pool.js'
import { Router } from './router.js'
import { createRequestContext, type RequestContext } from './context.js'
import { json, sendResponse, type HttpResponse } from './response.js'
import { isHttpError } from './errors.js'
import { registerHealthRoutes } from './routes/healthRoutes.js'
import { registerAuthRoutes } from './routes/authRoutes.js'
import { registerWorkspaceRoutes } from './routes/workspaceRoutes.js'
import { registerAgentRoutes } from './routes/agentRoutes.js'
import { registerRemoteAgentRoutes } from './routes/remoteAgentRoutes.js'
import { registerPublicSkillRoutes } from './routes/publicSkillRoutes.js'
import { A2aStreamingHub } from '../a2a/streaming.js'
import { createA2aHandler } from '../a2a/routes.js'
import { getQueueStats } from '../db/repositories/jobRepository.js'
import { hasDatabaseConfig } from '../config.js'

const DEFAULT_FRONTEND_DIST_DIR = fileURLToPath(new URL('../../../dist/', import.meta.url))

export interface SyncSpaceServerOptions {
  config?: ServerConfig
  logger?: Logger
  messagePersistence?: MessagePersistenceAdapter
  authorizer?: RealtimeAuthorizer
  /** Extra raw handlers tried before the REST router (used to mount the A2A surface). */
  rawHandlers?: RawHttpHandler[]
  queueStats?: () => { queuedJobs: number; runningJobs: number } | null
}

/** A raw handler returns a response when it claims the request, or null to pass through. */
export type RawHttpHandler = (ctx: RequestContext) => Promise<HttpResponse | null> | HttpResponse | null

export interface SyncSpaceServerHandle {
  server: HttpServer
  realtime: RealtimeServerHandle
  config: ServerConfig
  router: Router
  start(): Promise<AddressInfo>
  stop(): Promise<void>
}

export function createSyncSpaceServer(options: SyncSpaceServerOptions = {}): SyncSpaceServerHandle {
  const config = options.config ?? readConfig()
  const logger = options.logger ?? createLogger(config.logLevel)
  const messagePersistence = options.messagePersistence ?? createMessagePersistenceAdapter(config, logger)
  const authorizer = options.authorizer ?? createRealtimeAuthorizer(config, logger)

  const streamingHub = new A2aStreamingHub(config, logger)
  const a2aHandler = createA2aHandler({ config, logger, streamingHub })
  const rawHandlers: RawHttpHandler[] = [a2aHandler, ...(options.rawHandlers ?? [])]

  let realtime: RealtimeServerHandle
  const router = new Router()
  registerHealthRoutes(router, {
    config,
    realtimeStats: () => realtime.stats(),
    queueStats: hasDatabaseConfig(config) ? () => getQueueStats() : undefined
  })
  registerAuthRoutes(router, config)
  registerWorkspaceRoutes(router, config)
  registerAgentRoutes(router, config)
  registerRemoteAgentRoutes(router, config)
  registerPublicSkillRoutes(router, config)

  const server = createServer((request, response) => {
    void dispatch(request, response, router, config, logger, rawHandlers)
  })

  realtime = setupYWebsocketServer({ server, config, logger, messagePersistence, authorizer })

  return {
    server,
    realtime,
    config,
    router,
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
      await streamingHub.close().catch(() => undefined)
      await realtime.close()
      await new Promise<void>((resolve, reject) => {
        if (!server.listening) {
          resolve()
          return
        }
        server.close((error) => (error ? reject(error) : resolve()))
      })
      await closePool().catch(() => undefined)
    }
  }
}

async function dispatch(
  request: IncomingMessage,
  response: ServerResponse,
  router: Router,
  config: ServerConfig,
  logger: Logger,
  rawHandlers: RawHttpHandler[]
): Promise<void> {
  const ctx = createRequestContext(request, response, { trustProxy: config.trustProxy })
  const cors = corsHeaders(request)

  try {
    if (!isRequestOriginAllowed(request, config)) {
      sendResponse(response, json({ code: 'forbidden_origin', message: 'Origin is not allowed' }, 403), cors)
      return
    }

    if (ctx.method === 'OPTIONS') {
      response.writeHead(204, cors)
      response.end()
      return
    }

    for (const handler of rawHandlers) {
      const result = await handler(ctx)
      if (result) {
        sendResponse(response, result, cors)
        return
      }
      if (response.headersSent) return
    }

    const match = router.match(ctx.method, ctx.pathname)
    if (!match) {
      if (await tryServeFrontend(ctx, response, cors, logger)) return
      sendResponse(response, json({ code: 'not_found', message: 'Route not found' }, 404), cors)
      return
    }

    ctx.params = match.params
    const result = await match.handler(ctx)
    if (result) sendResponse(response, result, cors)
  } catch (error) {
    if (response.headersSent) return
    if (isHttpError(error)) {
      sendResponse(response, json({ code: error.code, message: error.message }, error.status), cors)
      return
    }
    logger.error('Unhandled HTTP error', { error: error instanceof Error ? error.message : String(error) })
    sendResponse(response, json({ code: 'internal_error', message: '서버 요청 처리 중 문제가 발생했습니다.' }, 500), cors)
  }
}

async function tryServeFrontend(
  ctx: RequestContext,
  response: ServerResponse,
  headers: Record<string, string>,
  logger: Logger
): Promise<boolean> {
  if (ctx.method !== 'GET' && ctx.method !== 'HEAD') return false
  if (isBackendPath(ctx.pathname)) return false

  const asset = await resolveFrontendAsset(ctx.pathname)
  if (!asset) return false

  try {
    const body = ctx.method === 'HEAD' ? null : await readFile(asset.path)
    response.writeHead(200, {
      ...headers,
      'content-type': asset.contentType,
      'cache-control': asset.cacheControl
    })
    response.end(body)
    return true
  } catch (error) {
    logger.warn('Failed to serve frontend asset', {
      path: ctx.pathname,
      error: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}

async function resolveFrontendAsset(pathname: string): Promise<{ path: string; contentType: string; cacheControl: string } | null> {
  const directPath = safeStaticPath(pathname)
  if (directPath && await isFile(directPath)) {
    return {
      path: directPath,
      contentType: contentTypeFor(directPath),
      cacheControl: pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'
    }
  }

  if (!shouldServeSpaFallback(pathname)) return null

  const indexPath = safeStaticPath('/index.html')
  if (!indexPath || !(await isFile(indexPath))) return null
  return {
    path: indexPath,
    contentType: 'text/html; charset=utf-8',
    cacheControl: 'no-cache'
  }
}

function safeStaticPath(pathname: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const normalized = decoded.replace(/^\/+/, '')
  const root = frontendDistDir()
  const resolvedPath = resolve(root, normalized)
  if (resolvedPath !== root && !resolvedPath.startsWith(`${root}${sep}`)) return null
  return resolvedPath
}

function frontendDistDir(): string {
  return resolve(process.env.FRONTEND_DIST_DIR || DEFAULT_FRONTEND_DIST_DIR)
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

function shouldServeSpaFallback(pathname: string): boolean {
  if (pathname.startsWith('/assets/')) return false
  if (extname(pathname)) return false
  return true
}

function isBackendPath(pathname: string): boolean {
  return (
    pathname === '/health' ||
    pathname === '/ready' ||
    pathname === '/skill.md' ||
    pathname === '/skill.json' ||
    pathname === '/.well-known/agent-card.json' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/a2a') ||
    pathname.startsWith('/chat/') ||
    pathname.startsWith('/doc/')
  )
}

function contentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.ico':
      return 'image/x-icon'
    case '.txt':
      return 'text/plain; charset=utf-8'
    case '.map':
      return 'application/json; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

function corsHeaders(request: IncomingMessage): Record<string, string> {
  const origin = request.headers.origin
  return {
    ...(origin ? { 'access-control-allow-origin': origin } : {}),
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,a2a-version,a2a-extensions'
  }
}
