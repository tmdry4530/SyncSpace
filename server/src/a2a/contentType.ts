import type { RequestContext } from '../http/context.js'
import { badRequest, HttpError } from '../http/errors.js'

export const A2A_CONTENT_TYPE = 'application/a2a+json'

/**
 * Validate the request Content-Type for A2A operations with a body.
 * `application/a2a+json` is preferred; `application/json` is accepted in
 * compatibility mode. Anything else is 415.
 */
export function validateA2aContentType(ctx: RequestContext): void {
  const raw = ctx.header('content-type')
  if (!raw) throw badRequest('missing_content_type', 'Content-Type header is required.')
  const mediaType = raw.split(';')[0]?.trim().toLowerCase() ?? ''
  if (mediaType !== A2A_CONTENT_TYPE && mediaType !== 'application/json') {
    throw new HttpError(415, 'unsupported_media_type', `Unsupported Content-Type: ${mediaType}. Use ${A2A_CONTENT_TYPE}.`)
  }
}
