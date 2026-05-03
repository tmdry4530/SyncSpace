import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { LogLevel } from './utils/logger.js'

export type RealtimeAuthMode = 'off' | 'supabase'

export interface ServerConfig {
  nodeEnv: string
  host: string
  port: number
  allowedOrigins: string[]
  wsAuthMode: RealtimeAuthMode
  supabaseUrl: string | null
  supabaseServiceRoleKey: string | null
  logLevel: LogLevel
}

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000']

loadLocalEnvFiles()

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const nodeEnv = env.NODE_ENV?.trim() || 'development'
  const host = env.HOST?.trim() || '0.0.0.0'
  const port = parsePort(env.PORT, 1234)
  const allowedOrigins = parseList(env.ALLOWED_ORIGINS, DEFAULT_ALLOWED_ORIGINS)
  const supabaseUrl = readFirstEnv(env, ['SUPABASE_URL', 'VITE_SUPABASE_URL'])
  const supabaseServiceRoleKey = readFirstEnv(env, ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SERVICE_ROLE_KEY'])
  const wsAuthMode = parseAuthMode(env.WS_AUTH_MODE, nodeEnv)
  const logLevel = parseLogLevel(env.LOG_LEVEL)

  assertSupabaseAuthConfig(wsAuthMode, { supabaseUrl, supabaseServiceRoleKey })

  return {
    nodeEnv,
    host,
    port,
    allowedOrigins,
    wsAuthMode,
    supabaseUrl,
    supabaseServiceRoleKey,
    logLevel
  }
}

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function readFirstEnv(env: NodeJS.ProcessEnv, keys: string[]): string | null {
  for (const key of keys) {
    const value = nonEmpty(env[key])
    if (value) return value
  }
  return null
}

function assertSupabaseAuthConfig(
  wsAuthMode: RealtimeAuthMode,
  config: Pick<ServerConfig, 'supabaseUrl' | 'supabaseServiceRoleKey'>
): void {
  if (wsAuthMode !== 'supabase') return

  const missing = [
    config.supabaseUrl ? null : 'SUPABASE_URL',
    config.supabaseServiceRoleKey ? null : 'SUPABASE_SERVICE_ROLE_KEY'
  ].filter(Boolean)

  if (missing.length > 0) {
    throw new Error(
      `WS_AUTH_MODE=supabase is enabled, but the backend process is missing: ${missing.join(', ')}. ` +
        'Set these on the Railway backend service Variables, not only on Vercel or another service.'
    )
  }
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value: ${value}`)
  }
  return parsed
}

function parseList(value: string | undefined, fallback: string[]): string[] {
  const parsed = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return parsed && parsed.length > 0 ? parsed : fallback
}

function parseAuthMode(value: string | undefined, nodeEnv: string): RealtimeAuthMode {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return nodeEnv === 'production' ? 'supabase' : 'off'
  if (normalized === 'off' || normalized === 'supabase') return normalized
  throw new Error(`Invalid WS_AUTH_MODE value: ${value}`)
}

function parseLogLevel(value: string | undefined): LogLevel {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return 'info'
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error' || normalized === 'silent') {
    return normalized
  }
  throw new Error(`Invalid LOG_LEVEL value: ${value}`)
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return true
  if (allowedOrigins.includes('*')) return true
  return allowedOrigins.includes(origin)
}

export function hasSupabaseAdminConfig(config: ServerConfig): boolean {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey)
}


function loadLocalEnvFiles(): void {
  const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')]
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue
    for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex <= 0) continue
      const key = trimmed.slice(0, separatorIndex).trim()
      const rawValue = trimmed.slice(separatorIndex + 1).trim()
      if (!key || process.env[key] !== undefined) continue
      process.env[key] = unquoteEnvValue(rawValue)
    }
  }
}

function unquoteEnvValue(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}
