import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import { badRequest } from '../http/errors.js'

/**
 * Test/dev-only escape hatch: when A2A_ALLOW_INSECURE_WEBHOOKS=true and NODE_ENV
 * is not production, http + loopback targets are permitted so webhook delivery
 * can be exercised against a local receiver. Never relaxes in production.
 */
function insecureWebhooksAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.A2A_ALLOW_INSECURE_WEBHOOKS === 'true'
}

/** SSRF guard: only https, public destinations are allowed for webhooks. */
export async function assertSafeWebhookUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw badRequest('invalid_webhook_url', 'Webhook URL is not a valid URL.')
  }
  if (insecureWebhooksAllowed()) return url
  if (url.protocol !== 'https:') {
    throw badRequest('insecure_webhook', 'Webhook URL must use https.')
  }

  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses: string[] = []
  if (isIP(host)) {
    addresses.push(host)
  } else {
    let resolved: { address: string }[]
    try {
      resolved = await lookup(host, { all: true })
    } catch {
      throw badRequest('webhook_dns_failure', 'Webhook host could not be resolved.')
    }
    addresses.push(...resolved.map((entry) => entry.address))
  }

  for (const address of addresses) {
    if (isBlockedAddress(address)) {
      throw badRequest('blocked_webhook_target', `Webhook target ${address} is not allowed (private/loopback/metadata).`)
    }
  }
  return url
}

export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip)
  if (family === 4) return isBlockedIpv4(ip)
  if (family === 6) return isBlockedIpv6(ip)
  return true
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number.parseInt(part, 10))
  if (parts.length !== 4 || parts.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true
  const [a, b] = parts as [number, number, number, number]
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // private
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local + cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true // private
  if (a === 192 && b === 168) return true // private
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
  if (a >= 224) return true // multicast/reserved
  return false
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  // IPv4-mapped (::ffff:127.0.0.1) — evaluate the embedded v4.
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped?.[1]) return isBlockedIpv4(mapped[1])
  if (lower.startsWith('fe80')) return true // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // unique local fc00::/7
  if (lower.startsWith('ff')) return true // multicast
  return false
}

export interface WebhookDeliveryResult {
  ok: boolean
  status: number
  error?: string
}

/** POST a StreamResponse-shaped payload to a webhook with an idempotency key. */
export async function deliverWebhook(
  url: string,
  payload: unknown,
  options: { authScheme?: string; credentials?: string | null; idempotencyKey: string; timeoutMs?: number } = { idempotencyKey: '' }
): Promise<WebhookDeliveryResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000)
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-a2a-idempotency-key': options.idempotencyKey
    }
    if (options.credentials) {
      headers.authorization = `${options.authScheme ?? 'Bearer'} ${options.credentials}`
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    return { ok: response.ok, status: response.status }
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timeout)
  }
}
