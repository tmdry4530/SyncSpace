import { useChatScrollRestoration } from '../hooks/useChatScrollRestoration'
import type { ChatMessage } from '../../../shared/types/contracts'
import { MessageItem } from './MessageItem'

interface MessageListProps {
  messages: ChatMessage[]
  isLoading: boolean
  canLoadMore: boolean
  onLoadMore: () => void
  variant?: 'default' | 'workbench'
}

export function MessageList({ messages, isLoading, canLoadMore, onLoadMore, variant = 'default' }: MessageListProps) {
  const listRef = useChatScrollRestoration(messages.length)
  const isWorkbench = variant === 'workbench'

  return (
    <div className={`message-list ${isWorkbench ? 'ap-wb-chat-scroll' : ''}`} ref={listRef}>
      {canLoadMore ? (
        <button className={`load-more ${isWorkbench ? 'ap-wb-load-more' : ''}`} onClick={onLoadMore} type="button">
          이전 메시지 더 보기
        </button>
      ) : null}
      {isLoading ? <p className={`page-state ${isWorkbench ? 'ap-wb-chat-state' : ''}`}>메시지를 불러오는 중...</p> : null}
      {!isLoading && messages.length === 0 ? (
        <p className={isWorkbench ? 'ap-wb-chat-empty' : 'empty-card'}>아직 메시지가 없습니다. 첫 메시지를 보내보세요.</p>
      ) : null}
      {messages.map((message) => (
        <MessageItem key={message.clientId ?? message.id} message={message} variant={variant} />
      ))}
    </div>
  )
}
