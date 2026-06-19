import { useEffect, useState } from 'react'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

export function useYProvider(serverUrl: string | null | undefined, roomName: string | null | undefined, doc: Y.Doc | null) {
  const [provider, setProvider] = useState<WebsocketProvider | null>(null)

  useEffect(() => {
    if (!serverUrl || !roomName || !doc) {
      setProvider(null)
      return
    }

    const nextProvider = new WebsocketProvider(serverUrl, roomName, doc, {
      connect: false,
      // The WS shares the API host, so the browser sends the HttpOnly session
      // cookie automatically — no bearer subprotocol is needed for auth.
      // Force every client through the backend room instead of relying on
      // same-browser BroadcastChannel shortcuts, and periodically resync so a
      // missed/backgrounded browser update is recovered without a full reload.
      disableBc: true,
      resyncInterval: 1_000,
      maxBackoffTime: 1_000
    })

    const connectTimer = window.setTimeout(() => nextProvider.connect(), 50)
    setProvider(nextProvider)

    return () => {
      window.clearTimeout(connectTimer)
      destroyProviderWithoutClosingConnectingSocket(nextProvider)
    }
  }, [doc, roomName, serverUrl])

  return provider
}

function destroyProviderWithoutClosingConnectingSocket(provider: WebsocketProvider) {
  const socket = provider.ws
  if (socket?.readyState !== WebSocket.CONNECTING) {
    provider.destroy()
    return
  }

  provider.shouldConnect = false
  const destroy = () => provider.destroy()
  socket.addEventListener('open', destroy, { once: true })
  socket.addEventListener('close', destroy, { once: true })
  window.setTimeout(destroy, 1_000)
}
