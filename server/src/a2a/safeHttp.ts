import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns'
import { isIP } from 'node:net'
import { isBlockedAddress } from './push.js'

/**
 * SSRF-safe outbound HTTP. Unlike a plain fetch (which re-resolves DNS after a
 * pre-check, leaving a TOCTOU rebinding window), this resolves the host, blocks
 * private/loopback/link-local/metadata IPs, and PINS the connection to the
 * validated IP — the Host header / TLS SNI stay the original hostname. Redirects
 * are refused (3xx → error) so a redirect can't escape the validated origin.
 *
 * Dev escape hatch: when A2A_ALLOW_INSECURE_WEBHOOKS=true and NODE_ENV is not
 * production, http + loopback targets are allowed (so a localhost stub can be
 * exercised). Never relaxes in production.
 */

const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_MAX_BYTES = 256 * 1024

export class SafeHttpError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'SafeHttpError'
  }
}

function insecureAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.A2A_ALLOW_INSECURE_WEBHOOKS === 'true'
}

type PinnedLookupCallback =
  & ((err: NodeJS.ErrnoException | null, address: string, family: number) => void)
  & ((err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void)

/** dns.lookup replacement that validates + pins the resolved address. */
function pinnedLookup(
  hostname: string,
  options: LookupOptions,
  callback: PinnedLookupCallback
): void {
  dnsLookup(hostname, { all: true }, (err, addresses: LookupAddress[]) => {
    if (err) return callback(err, '', 0)
    const chosen = addresses[0]
    if (!chosen) return callback(new Error(`No address for ${hostname}`) as NodeJS.ErrnoException, '', 0)
    for (const entry of addresses) {
      if (isBlockedAddress(entry.address)) {
        return callback(new Error(`Blocked address ${entry.address} for ${hostname}`) as NodeJS.ErrnoException, '', 0)
      }
    }
    if (options?.all) {
      callback(null, addresses)
      return
    }
    callback(null, chosen.address, chosen.family)
  })
}

export interface SafeHttpRequest {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  maxBytes?: number
  timeoutMs?: number
}

export interface SafeHttpResponse {
  status: number
  text: string
}

export async function safeHttp(rawUrl: string, options: SafeHttpRequest = {}): Promise<SafeHttpResponse> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new SafeHttpError('invalid_url', `Invalid URL: ${rawUrl}`)
  }

  const insecure = insecureAllowed()
  if (!insecure && url.protocol !== 'https:') {
    throw new SafeHttpError('insecure_url', 'Outbound URL must use https.')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new SafeHttpError('bad_protocol', 'Only http(s) is allowed.')
  }

  // Hard-block IP-literal private/loopback/metadata hosts. Node skips dns.lookup
  // for IP literals, so the pinned-lookup guard below never fires for them.
  const literalHost = url.hostname.replace(/^\[|\]$/g, '')
  if (!insecure && isIP(literalHost) && isBlockedAddress(literalHost)) {
    throw new SafeHttpError('blocked_address', `Blocked address ${literalHost} (private/loopback/metadata).`)
  }

  const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return new Promise<SafeHttpResponse>((resolve, reject) => {
    const req = requestFn(
      url,
      {
        method: options.method ?? 'GET',
        headers: options.headers ?? {},
        // In insecure dev mode use the default resolver (allows loopback); otherwise pin.
        ...(insecure ? {} : { lookup: pinnedLookup })
      },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400) {
          res.destroy()
          reject(new SafeHttpError('redirect_refused', `Redirect (${status}) is not allowed.`))
          return
        }
        let size = 0
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > maxBytes) {
            req.destroy()
            reject(new SafeHttpError('too_large', 'Response exceeds the size limit.'))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => resolve({ status, text: Buffer.concat(chunks).toString('utf8') }))
        res.on('error', (error) => reject(new SafeHttpError('response_error', error.message)))
      }
    )
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      reject(new SafeHttpError('timeout', `Request timed out after ${timeoutMs}ms.`))
    })
    req.on('error', (error) => {
      // Surface SafeHttpError as-is; wrap raw socket/DNS errors (incl. blocked-IP from lookup).
      reject(error instanceof SafeHttpError ? error : new SafeHttpError('request_failed', error.message))
    })
    if (options.body) req.write(options.body)
    req.end()
  })
}

export async function safeHttpJson<T = unknown>(rawUrl: string, options: SafeHttpRequest = {}): Promise<{ status: number; json: T }> {
  const res = await safeHttp(rawUrl, options)
  let json: T
  try {
    json = JSON.parse(res.text) as T
  } catch {
    throw new SafeHttpError('invalid_json', 'Response body is not valid JSON.')
  }
  return { status: res.status, json }
}
