import { FormEvent } from 'react'
import { Send } from 'lucide-react'
import { useAuthStore } from '../../../shared/stores/authStore'
import { useChatUiStore } from '../../../shared/stores/chatUiStore'

interface MessageComposerProps {
  channelId: string
  onSend: (input: { content: string; userId: string }) => void
}

export function MessageComposer({ channelId, onSend }: MessageComposerProps) {
  const user = useAuthStore((state) => state.user)
  const draft = useChatUiStore((state) => state.draftByChannelId[channelId] ?? '')
  const setDraft = useChatUiStore((state) => state.setDraft)
  const clearDraft = useChatUiStore((state) => state.clearDraft)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || !user) return
    onSend({ content, userId: user.id })
    clearDraft(channelId)
  }

  return (
    <form className="message-composer" onSubmit={handleSubmit}>
      <input
        value={draft}
        onChange={(event) => setDraft(channelId, event.target.value)}
        placeholder="메시지를 입력하고 Enter"
      />
      <button className="button primary icon-button-send" disabled={!draft.trim() || !user} type="submit" aria-label="보내기">
        <Send size={18} />
      </button>
    </form>
  )
}
