export interface ClientEnv {
  apiUrl: string
  wsUrl: string
  wsAuthMode: 'off' | 'session'
}

export function readClientEnv(): ClientEnv {
  const wsUrl = import.meta.env.VITE_WS_URL?.replace(/\/$/, '') || 'ws://localhost:1234'

  return {
    apiUrl: import.meta.env.VITE_API_URL?.replace(/\/$/, '') || httpUrlFromWsUrl(wsUrl),
    wsUrl,
    wsAuthMode: readWsAuthMode()
  }
}

function httpUrlFromWsUrl(wsUrl: string): string {
  if (wsUrl.startsWith('wss://')) return `https://${wsUrl.slice('wss://'.length)}`
  if (wsUrl.startsWith('ws://')) return `http://${wsUrl.slice('ws://'.length)}`
  return wsUrl
}

function readWsAuthMode(): ClientEnv['wsAuthMode'] {
  const configured = import.meta.env.VITE_WS_AUTH_MODE?.trim().toLowerCase()
  if (configured === 'off' || configured === 'session') return configured
  return 'session'
}
