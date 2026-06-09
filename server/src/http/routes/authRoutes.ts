import type { ServerConfig } from '../../config.js'
import type { Router } from '../router.js'
import { json } from '../response.js'
import { badRequest, forbidden, tooManyRequests } from '../errors.js'
import { RateLimiter } from '../rateLimit.js'
import { authenticateUser, registerUser, toAuthUser } from '../../auth/appAuth.js'
import { destroySession, issueSession } from '../../auth/session.js'
import { optionalSession, requireSession, readSessionToken } from '../../auth/middleware.js'
import { buildSessionClearCookie, buildSessionSetCookie } from '../../auth/cookies.js'
import { findUserById, toAuthUser as rowToAuthUser } from '../../db/repositories/userRepository.js'
import { writeAuditLog } from '../../db/repositories/auditRepository.js'
import { hashIp } from '../../utils/crypto.js'

function registrationAllowed(config: ServerConfig): boolean {
  return config.nodeEnv !== 'production' || process.env.AUTH_ALLOW_OPEN_REGISTRATION === 'true'
}

// 10 attempts/min per IP+email for login; 5 registrations/min per IP.
const loginLimiter = new RateLimiter(60_000, 10)
const registerLimiter = new RateLimiter(60_000, 5)

export function registerAuthRoutes(router: Router, config: ServerConfig): void {
  router.post('/api/auth/register', async (ctx) => {
    if (!registrationAllowed(config)) throw forbidden('회원가입이 비활성화되어 있습니다.', 'registration_disabled')
    if (!registerLimiter.check(ctx.ip ?? 'unknown')) throw tooManyRequests('잠시 후 다시 시도해주세요.')
    const body = await ctx.json<{ email?: string; password?: string; displayName?: string; color?: string }>()
    if (!body.email || !body.password) throw badRequest('missing_fields', '이메일과 비밀번호가 필요합니다.')

    const { user, userId } = await registerUser({
      email: body.email,
      password: body.password,
      ...(body.displayName ? { displayName: body.displayName } : {}),
      ...(body.color ? { color: body.color } : {})
    })
    const session = await issueSession(config, userId, { userAgent: ctx.header('user-agent'), ip: ctx.ip })
    return json({ user }, 200, { 'set-cookie': buildSessionSetCookie(config, session.token, session.expiresAt) })
  })

  router.post('/api/auth/login', async (ctx) => {
    const body = await ctx.json<{ email?: string; password?: string }>()
    if (!body.email || !body.password) throw badRequest('missing_fields', '이메일과 비밀번호가 필요합니다.')
    if (!loginLimiter.check(`${ctx.ip ?? 'unknown'}:${body.email.toLowerCase()}`)) {
      throw tooManyRequests('로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.')
    }

    let user
    try {
      user = await authenticateUser(body.email, body.password)
    } catch (error) {
      await writeAuditLog({
        action: 'auth.login_failed',
        resourceType: 'auth',
        resourceId: body.email.toLowerCase(),
        ipHash: hashIp(ctx.ip, config.authSecret),
        userAgent: ctx.header('user-agent')
      }).catch(() => undefined)
      throw error
    }
    const session = await issueSession(config, user.id, { userAgent: ctx.header('user-agent'), ip: ctx.ip })
    await writeAuditLog({
      action: 'auth.login',
      resourceType: 'auth',
      resourceId: user.id,
      ipHash: hashIp(ctx.ip, config.authSecret),
      userAgent: ctx.header('user-agent')
    }).catch(() => undefined)
    return json({ user: toAuthUser(user) }, 200, {
      'set-cookie': buildSessionSetCookie(config, session.token, session.expiresAt)
    })
  })

  router.post('/api/auth/logout', async (ctx) => {
    const token = readSessionToken(ctx, config)
    if (token) await destroySession(config, token)
    return json({ ok: true }, 200, { 'set-cookie': buildSessionClearCookie(config) })
  })

  router.get('/api/auth/me', async (ctx) => {
    const session = await optionalSession(ctx, config)
    if (!session) return json({ user: null }, 200)
    const user = await findUserById(session.userId)
    return json({ user: user ? rowToAuthUser(user) : null }, 200)
  })

  router.post('/api/auth/refresh', async (ctx) => {
    const session = await requireSession(ctx, config)
    const issued = await issueSession(config, session.userId, { userAgent: ctx.header('user-agent'), ip: ctx.ip })
    const oldToken = readSessionToken(ctx, config)
    if (oldToken) await destroySession(config, oldToken)
    const user = await findUserById(session.userId)
    return json({ user: user ? rowToAuthUser(user) : null }, 200, {
      'set-cookie': buildSessionSetCookie(config, issued.token, issued.expiresAt)
    })
  })
}
