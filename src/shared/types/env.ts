export interface ClientEnv {
  supabaseUrl: string | null
  supabaseAnonKey: string | null
  apiUrl: string
  wsUrl: string
  wsAuthMode: 'off' | 'supabase'
}

export function readClientEnv(): ClientEnv {
  const wsUrl = import.meta.env.VITE_WS_URL?.replace(/\/$/, '') || 'ws://localhost:1234'
  const supabaseUrl = emptyToNull(import.meta.env.VITE_SUPABASE_URL)
  const supabaseAnonKey = emptyToNull(import.meta.env.VITE_SUPABASE_ANON_KEY)

  return {
    supabaseUrl,
    supabaseAnonKey,
    apiUrl: (import.meta.env.VITE_API_URL?.replace(/\/$/, '') || httpUrlFromWsUrl(wsUrl)),
    wsUrl,
    wsAuthMode: readWsAuthMode({ supabaseUrl, supabaseAnonKey })
  }
}

export function hasSupabaseEnv(env = readClientEnv()): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey)
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function httpUrlFromWsUrl(wsUrl: string): string {
  if (wsUrl.startsWith('wss://')) return `https://${wsUrl.slice('wss://'.length)}`
  if (wsUrl.startsWith('ws://')) return `http://${wsUrl.slice('ws://'.length)}`
  return wsUrl
}

function readWsAuthMode(env: Pick<ClientEnv, 'supabaseUrl' | 'supabaseAnonKey'>): ClientEnv['wsAuthMode'] {
  const configured = import.meta.env.VITE_WS_AUTH_MODE?.trim().toLowerCase()
  if (configured === 'off' || configured === 'supabase') return configured
  return env.supabaseUrl && env.supabaseAnonKey ? 'supabase' : 'off'
}
