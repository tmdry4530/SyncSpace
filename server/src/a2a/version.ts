import type { ServerConfig } from '../config.js'
import type { RequestContext } from '../http/context.js'
import { badRequest, HttpError } from '../http/errors.js'

/**
 * Validate the A2A-Version header. Production requires it; development tolerates
 * a missing header. An unsupported version is a spec-compatible 400.
 */
export function validateA2aVersion(ctx: RequestContext, config: ServerConfig): void {
  const header = ctx.header('a2a-version')
  if (!header) {
    if (config.nodeEnv === 'production') {
      throw badRequest('version_required', 'A2A-Version header is required.')
    }
    return
  }
  if (header.trim() !== config.a2aVersion) {
    throw new HttpError(400, 'unsupported_version', `A2A-Version ${header} is not supported; expected ${config.a2aVersion}.`, {
      supportedVersions: [config.a2aVersion]
    })
  }
}
