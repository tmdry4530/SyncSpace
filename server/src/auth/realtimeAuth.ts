import type { IncomingMessage } from 'node:http'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServerConfig } from '../config.js'
import { createSupabaseAdminClient } from '../persistence/supabaseAdmin.js'
import type { RealtimeRoute } from '../realtime/roomNames.js'
import type { Logger } from '../utils/logger.js'
import { parseCookies } from '../http/context.js'
import { resolveSession } from './session.js'
import { resolveAgentToken } from './agentToken.js'
import { getMembership } from '../db/repositories/workspaceRepository.js'

export interface RealtimeAuthContext {
  request: IncomingMessage
  route: RealtimeRoute
}

export interface RealtimeAuthResult {
  ok: boolean
  userId?: string
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

export class SupabaseRealtimeAuthorizer implements RealtimeAuthorizer {
  constructor(
    private readonly client: SupabaseClient,
    private readonly logger: Logger
  ) {}

  async authorize(context: RealtimeAuthContext): Promise<RealtimeAuthResult> {
    const token = getAccessToken(context.request)
    if (!token) return { ok: false, reason: 'missing_access_token' }

    const userResult = await this.client.auth.getUser(token)
    const userId = userResult.data?.user?.id
    if (userResult.error || !userId) {
      return { ok: false, reason: 'invalid_access_token' }
    }

    const membershipResult = await this.client
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', context.route.workspaceId)
      .eq('user_id', userId)
      .maybeSingle()

    if (membershipResult.error) {
      this.logger.warn('Realtime membership check failed', {
        workspaceId: context.route.workspaceId,
        userId,
        error: membershipResult.error.message
      })
      return { ok: false, reason: 'membership_check_failed' }
    }

    if (!membershipResult.data) return { ok: false, reason: 'not_workspace_member' }
    return { ok: true, userId }
  }
}

/**
 * App-owned realtime authorization: resolves a session cookie / bearer token (or
 * an agent token) and confirms workspace membership before allowing the upgrade.
 */
export class SessionRealtimeAuthorizer implements RealtimeAuthorizer {
  constructor(
    private readonly config: ServerConfig,
    private readonly logger: Logger
  ) {}

  async authorize(context: RealtimeAuthContext): Promise<RealtimeAuthResult> {
    const token = readSessionToken(context.request, this.config)
    if (!token) return { ok: false, reason: 'missing_session' }

    try {
      const session = await resolveSession(this.config, token)
      if (session) {
        const membership = await getMembership(context.route.workspaceId, session.userId)
        if (!membership) return { ok: false, reason: 'not_workspace_member' }
        return { ok: true, userId: session.userId }
      }

      // Fall back to agent token (agents connect to the same rooms as participants).
      const agent = await resolveAgentToken(this.config, token)
      if (agent && agent.workspaceId === context.route.workspaceId) {
        return { ok: true, userId: agent.agentId }
      }
      return { ok: false, reason: 'invalid_session' }
    } catch (error) {
      this.logger.warn('Realtime session authorization failed', {
        workspaceId: context.route.workspaceId,
        error: error instanceof Error ? error.message : String(error)
      })
      return { ok: false, reason: 'authorization_error' }
    }
  }
}

export function createRealtimeAuthorizer(config: ServerConfig, logger: Logger): RealtimeAuthorizer {
  if (config.wsAuthMode === 'off') return new AllowAllRealtimeAuthorizer()
  if (config.wsAuthMode === 'session') return new SessionRealtimeAuthorizer(config, logger)
  return new SupabaseRealtimeAuthorizer(createSupabaseAdminClient(config), logger)
}

function readSessionToken(request: IncomingMessage, config: ServerConfig): string | null {
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
