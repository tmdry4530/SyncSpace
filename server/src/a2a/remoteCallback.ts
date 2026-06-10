import { timingSafeEqual } from 'node:crypto'
import type { ServerConfig } from '../config.js'
import { hashToken } from '../utils/crypto.js'

/**
 * Stateless per-task callback credential for inbound A2A push.
 *
 * When we invoke a remote agent we register a push-notification config on the
 * remote pointing at `${a2aInterfaceUrl}/remote-callback/{taskId}` with a token
 * derived as HMAC(pepper, taskId). The remote echoes the token back; we recompute
 * and compare. No storage/migration is needed, and a leaked token only exposes the
 * single task it scopes (an attacker still cannot push arbitrary state — the
 * callback re-fetches authoritative state from the remote, never trusts the body).
 */

export function remoteCallbackToken(taskId: string, config: ServerConfig): string | null {
  if (!config.agentTokenPepper) return null
  return hashToken(`remote-callback:${taskId}`, config.agentTokenPepper)
}

export function remoteCallbackUrl(taskId: string, config: ServerConfig): string {
  // a2aInterfaceUrl is the `/a2a` base; the callback lives under the same path tree
  // so the existing A2A request router (isA2aPath) dispatches it.
  return `${config.a2aInterfaceUrl}/remote-callback/${encodeURIComponent(taskId)}`
}

export function verifyRemoteCallbackToken(taskId: string, presented: string | null | undefined, config: ServerConfig): boolean {
  const expected = remoteCallbackToken(taskId, config)
  if (!expected || !presented) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(presented)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
