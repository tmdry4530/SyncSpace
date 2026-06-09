import type { ServerConfig } from '../config.js'
import type { RequestContext } from '../http/context.js'
import { notFound, unauthorized } from '../http/errors.js'
import { resolveSession } from '../auth/session.js'
import { resolveAgentToken } from '../auth/agentToken.js'
import { readBearerToken } from '../auth/middleware.js'
import { getMembership } from '../db/repositories/workspaceRepository.js'

export interface A2aPrincipal {
  kind: 'agent' | 'session'
  participantId: string
  /** Fixed workspace for agent tokens; null for sessions until a target is chosen. */
  workspaceId: string | null
  userId?: string
  agentId?: string
  scopes: string[]
}

/** Resolve an A2A caller from an agent bearer token or a user session. */
export async function resolvePrincipal(ctx: RequestContext, config: ServerConfig): Promise<A2aPrincipal | null> {
  const bearer = readBearerToken(ctx)
  if (bearer) {
    const agent = await resolveAgentToken(config, bearer)
    if (agent) {
      return {
        kind: 'agent',
        participantId: agent.participantId,
        workspaceId: agent.workspaceId,
        agentId: agent.agentId,
        scopes: agent.scopes
      }
    }
  }

  const sessionToken = ctx.cookies[config.sessionCookieName] ?? bearer
  if (sessionToken) {
    const session = await resolveSession(config, sessionToken)
    if (session) {
      return {
        kind: 'session',
        participantId: session.participantId,
        workspaceId: null,
        userId: session.userId,
        scopes: ['task:read', 'task:write', 'task:cancel', 'push:write']
      }
    }
  }

  return null
}

export async function requirePrincipal(ctx: RequestContext, config: ServerConfig): Promise<A2aPrincipal> {
  const principal = await resolvePrincipal(ctx, config)
  if (!principal) throw unauthorized('A2A 호출에는 인증이 필요합니다.', 'unauthorized')
  return principal
}

export function requireScope(principal: A2aPrincipal, scope: string): void {
  if (!principal.scopes.includes(scope)) {
    throw unauthorized('토큰 스코프가 부족합니다.', 'insufficient_scope')
  }
}

/**
 * Confirm the principal may act in `workspaceId`. Returns 404 (not 403) so the
 * existence of out-of-scope workspaces/tasks is never revealed.
 */
export async function assertWorkspaceAccess(principal: A2aPrincipal, workspaceId: string): Promise<void> {
  if (principal.kind === 'agent') {
    if (principal.workspaceId !== workspaceId) throw notFound()
    return
  }
  if (!principal.userId) throw notFound()
  const membership = await getMembership(workspaceId, principal.userId)
  if (!membership) throw notFound()
}
