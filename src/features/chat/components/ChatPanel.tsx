import { useEffect, useMemo } from 'react'
import { uniqueBy } from '../../../shared/utils/dedupe'
import { useChannelMessagesRealtime } from '../../realtime/useServerStateRealtime'
import type { ConnectionStatus } from '../../realtime/useConnectionStatus'
import { useYChatRoom } from '../realtime/useYChatRoom'
import { useMessagesInfiniteQuery } from '../queries/useMessagesInfiniteQuery'
import { MessageComposer } from './MessageComposer'
import { MessageList } from './MessageList'

interface ChatPanelProps {
  workspaceId: string
  channelId: string
  channelName?: string | undefined
  hideStatus?: boolean
  onStatusChange?: (status: ConnectionStatus) => void
}

export function ChatPanel({ workspaceId, channelId, channelName, hideStatus = false, onStatusChange }: ChatPanelProps) {
  useChannelMessagesRealtime(channelId)
  const historyQuery = useMessagesInfiniteQuery(channelId)
  const realtime = useYChatRoom(workspaceId, channelId)

  const status = realtime.status === 'disconnected' && realtime.presence.length > 0 ? 'connected' : realtime.status

  useEffect(() => {
    onStatusChange?.(status)
  }, [onStatusChange, status])

  const messages = useMemo(() => {
    const history = historyQuery.data?.pages.flatMap((page) => page.items).reverse() ?? []
    return uniqueBy([...history, ...realtime.messages], (message) => message.clientId ?? message.id).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    )
  }, [historyQuery.data?.pages, realtime.messages])

  return (
    <section className="chat-panel">
      <header className="panel-title">
        <div>
          <p className="eyebrow">채팅</p>
          <h1>#{channelName ?? channelId.slice(0, 8)}</h1>
        </div>
        {hideStatus ? null : <span className={`status-pill ${status}`}>{status}</span>}
      </header>
      <MessageList
        messages={messages}
        isLoading={historyQuery.isLoading}
        onLoadMore={() => void historyQuery.fetchNextPage()}
        canLoadMore={Boolean(historyQuery.hasNextPage)}
      />
      <MessageComposer channelId={channelId} onSend={realtime.sendMessage} />
    </section>
  )
}
