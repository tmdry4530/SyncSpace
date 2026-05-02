import type { ChatMessage } from '../../../shared/types/contracts'
import { useAuthStore } from '../../../shared/stores/authStore'
import { formatDisplayName } from '../../../shared/utils/displayName'

export function MessageItem({ message }: { message: ChatMessage }) {
  const user = useAuthStore((state) => state.user)
  const isMe = user?.id === message.userId
  const label = formatDisplayName(message.user?.displayName, `사용자 ${message.userId.slice(0, 4)}`)
  const color = message.user?.color ?? '#8b5cf6'

  return (
    <article className={`message-item ${isMe ? 'message-mine' : 'message-others'}`}>
      <div className="avatar" style={{ backgroundColor: color }} aria-hidden="true">
        {label.slice(0, 1).toUpperCase()}
      </div>
      <div className="message-content-wrapper">
        <header>
          <strong title={message.user?.displayName ?? message.userId}>{label}</strong>
          <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
        </header>
        <div className="message-bubble">
          <p>{message.content}</p>
          {message.status && message.status !== 'sent' ? <span className="pending-chip">{message.status}</span> : null}
        </div>
      </div>
    </article>
  )
}
