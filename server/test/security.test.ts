import { describe, expect, it } from 'vitest'
import { assertSafeWebhookUrl, isBlockedAddress } from '../src/a2a/push.js'
import { ConcurrencyLimiter, RateLimiter } from '../src/http/rateLimit.js'

describe('SSRF guard', () => {
  it('blocks loopback, private, link-local, and metadata addresses', () => {
    for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.5.4', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fe80::1', 'fc00::1']) {
      expect(isBlockedAddress(ip), ip).toBe(true)
    }
  })

  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
      expect(isBlockedAddress(ip), ip).toBe(false)
    }
  })

  it('rejects http and private literal-IP webhook URLs', async () => {
    delete process.env.A2A_ALLOW_INSECURE_WEBHOOKS
    await expect(assertSafeWebhookUrl('http://example.com/hook')).rejects.toThrow()
    await expect(assertSafeWebhookUrl('https://10.0.0.1/hook')).rejects.toThrow()
    await expect(assertSafeWebhookUrl('https://169.254.169.254/latest')).rejects.toThrow()
  })

  it('allows insecure targets only when the env escape hatch is enabled (non-prod)', async () => {
    process.env.A2A_ALLOW_INSECURE_WEBHOOKS = 'true'
    try {
      await expect(assertSafeWebhookUrl('http://127.0.0.1:9999/hook')).resolves.toBeInstanceOf(URL)
    } finally {
      delete process.env.A2A_ALLOW_INSECURE_WEBHOOKS
    }
  })
})

describe('rate limiting', () => {
  it('allows up to max then blocks within the window, and resets after', () => {
    const limiter = new RateLimiter(1000, 3)
    expect(limiter.check('k', 0)).toBe(true)
    expect(limiter.check('k', 1)).toBe(true)
    expect(limiter.check('k', 2)).toBe(true)
    expect(limiter.check('k', 3)).toBe(false)
    expect(limiter.check('k', 1001)).toBe(true) // window reset
  })

  it('isolates keys', () => {
    const limiter = new RateLimiter(1000, 1)
    expect(limiter.check('a', 0)).toBe(true)
    expect(limiter.check('b', 0)).toBe(true)
    expect(limiter.check('a', 0)).toBe(false)
  })
})

describe('concurrency limiting', () => {
  it('caps concurrent slots and frees them on release', () => {
    const limiter = new ConcurrencyLimiter(2)
    const a = limiter.acquire('k')
    const b = limiter.acquire('k')
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(limiter.acquire('k')).toBeNull()
    a!()
    expect(limiter.acquire('k')).not.toBeNull()
  })
})
