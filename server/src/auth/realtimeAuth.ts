import type { IncomingMessage } from 'node:http'
import type { ServerConfig } from '../config.js'
import type { RealtimeRoute } from '../realtime/roomNames.js'
import type { ParticipantType } from '../types/contracts.js'
import type { Logger } from '../utils/logger.js'
import { parseCookies } from '../http/context.js'
import { resolveAgentToken } from './agentToken.js'

export interface RealtimeAuthContext {
  request: IncomingMessage
  route: RealtimeRoute
}

/**
 * Authenticated identity bound to a realtime connection at upgrade time.
 * Persistence paths must derive message authorship from this — never from
 * client-controlled Yjs document content.
 */
export interface RealtimeConnectionIdentity {
  participantId: string
  agentId: string | null
  authorType: ParticipantType
}

export interface RealtimeAuthResult {
  ok: boolean
  userId?: string
  identity?: RealtimeConnectionIdentity
  reason?: string
}

export interface RealtimeAuthorizer {
  authorize(context: RealtimeAuthContext): Promise<RealtimeAuthResult>
}

export class AllowAllRealtimeAuthorizer implements RealtimeAuthorizer {
  async authorize(): Promise<RealtimeAuthResult> {
    return { ok: true }
  }
}

/**
 * App-owned realtime authorization: resolves the agent credential (session
 * cookie / bearer token / ?token=) and confirms it belongs to the room's
 * workspace before allowing the WebSocket upgrade.
 */
export class AgentRealtimeAuthorizer implements RealtimeAuthorizer {
  constructor(
    private readonly config: ServerConfig,
    private readonly logger: Logger
  ) {}

  async authorize(context: RealtimeAuthContext): Promise<RealtimeAuthResult> {
    const token = readAuthToken(context.request, this.config)
    if (!token) return { ok: false, reason: 'missing_credential' }

    try {
      const agent = await resolveAgentToken(this.config, token)
      if (!agent) return { ok: false, reason: 'invalid_credential' }
      if (agent.workspaceId !== context.route.workspaceId) return { ok: false, reason: 'not_workspace_member' }
      const principalId = agent.agentId ?? agent.remoteAgentId
      return {
        ok: true,
        ...(principalId ? { userId: principalId } : {}),
        // resolveAgentToken only resolves agent-owned participants, so the
        // authenticated author type is always 'agent'.
        identity: { participantId: agent.participantId, agentId: agent.agentId, authorType: 'agent' }
      }
    } catch (error) {
      this.logger.warn('Realtime authorization failed', {
        workspaceId: context.route.workspaceId,
        error: error instanceof Error ? error.message : String(error)
      })
      return { ok: false, reason: 'authorization_error' }
    }
  }
}

export function createRealtimeAuthorizer(config: ServerConfig, logger: Logger): RealtimeAuthorizer {
  if (config.wsAuthMode === 'off') return new AllowAllRealtimeAuthorizer()
  return new AgentRealtimeAuthorizer(config, logger)
}

function readAuthToken(request: IncomingMessage, config: ServerConfig): string | null {
  const cookies = parseCookies(request.headers.cookie)
  const cookieToken = cookies[config.sessionCookieName]
  if (cookieToken) return cookieToken
  return getAccessToken(request)
}

export function getAccessToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim() || null
  }

  const protocolHeader = request.headers['sec-websocket-protocol']
  const protocolToken = Array.isArray(protocolHeader)
    ? protocolHeader.find((item) => item.startsWith('bearer,'))
    : protocolHeader?.startsWith('bearer,')
      ? protocolHeader
      : undefined
  if (protocolToken) {
    const [, token] = protocolToken.split(',', 2)
    return token?.trim() || null
  }

  try {
    const url = new URL(request.url ?? '/', 'http://syncspace.local')
    return url.searchParams.get('token') ?? url.searchParams.get('access_token')
  } catch {
    return null
  }
}
