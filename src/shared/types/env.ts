export interface ClientEnv {
  supabaseUrl: string | null
  supabaseAnonKey: string | null
  apiUrl: string
  wsUrl: string
  wsAuthMode: 'off' | 'supabase'
}

export function readClientEnv(): ClientEnv {
  const wsUrl = import.meta.env.VITE_WS_URL?.replace(/\/$/, '') || 'ws://localhost:1234'
  return {
    supabaseUrl: emptyToNull(import.meta.env.VITE_SUPABASE_URL),
    supabaseAnonKey: emptyToNull(import.meta.env.VITE_SUPABASE_ANON_KEY),
    apiUrl: (import.meta.env.VITE_API_URL?.replace(/\/$/, '') || httpUrlFromWsUrl(wsUrl)),
    wsUrl,
    wsAuthMode: import.meta.env.VITE_WS_AUTH_MODE === 'supabase' ? 'supabase' : 'off'
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
