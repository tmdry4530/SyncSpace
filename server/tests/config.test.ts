import { describe, expect, it } from 'vitest'
import { isOriginAllowed, readConfig } from '../src/config.js'

describe('readConfig', () => {
  it('defaults to local development-safe values', () => {
    const config = readConfig({})
    expect(config.port).toBe(1234)
    expect(config.host).toBe('0.0.0.0')
    expect(config.wsAuthMode).toBe('off')
    expect(config.allowedOrigins).toContain('http://localhost:5173')
  })

  it('requires Supabase server secrets when auth mode is supabase', () => {
    expect(() => readConfig({ WS_AUTH_MODE: 'supabase' })).toThrow(/SUPABASE_URL/)
  })

  it('allows wildcard origins only when explicitly configured', () => {
    expect(isOriginAllowed('https://example.com', ['*'])).toBe(true)
    expect(isOriginAllowed('https://example.com', ['http://localhost:5173'])).toBe(false)
  })
})
