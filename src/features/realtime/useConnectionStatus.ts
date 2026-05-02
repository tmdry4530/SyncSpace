import { useEffect, useState } from 'react'
import type { WebsocketProvider } from 'y-websocket'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

export function useConnectionStatus(provider: WebsocketProvider | null): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(() => readStatus(provider))

  useEffect(() => {
    if (!provider) {
      setStatus('idle')
      return
    }

    const syncStatus = () => setStatus(readStatus(provider))

    function handleStatus(event: { status: 'connected' | 'disconnected' | 'connecting' }) {
      setStatus(event.status)
      // y-websocket can emit before React subscribes during fast local handshakes.
      // Re-read the underlying socket on the next tick so the UI does not get stuck as disconnected.
      window.setTimeout(syncStatus, 0)
    }

    syncStatus()
    provider.on('status', handleStatus)
    provider.on('sync', syncStatus)
    const intervalId = window.setInterval(syncStatus, 1000)

    return () => {
      provider.off('status', handleStatus)
      provider.off('sync', syncStatus)
      window.clearInterval(intervalId)
    }
  }, [provider])

  return status
}

function readStatus(provider: WebsocketProvider | null): ConnectionStatus {
  if (!provider) return 'idle'
  if (provider.wsconnected || provider.synced || provider.ws?.readyState === WebSocket.OPEN) return 'connected'
  if (provider.wsconnecting || provider.ws?.readyState === WebSocket.CONNECTING || provider.shouldConnect) return 'connecting'
  return 'disconnected'
}
