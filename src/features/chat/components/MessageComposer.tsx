import { FormEvent, useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { useAuthStore } from '../../../shared/stores/authStore'
import { useChatUiStore } from '../../../shared/stores/chatUiStore'
import { useAgentsQuery } from '../../agents/queries/useAgentsQuery'
import { useInvokeAgentMutation } from '../../agents/mutations/useInvokeAgentMutation'
import { MentionSuggestions, filterAgentsByQuery } from '../../agents/components/MentionSuggestions'
import { useRemoteAgentsQuery } from '../../remote-agents/queries/useRemoteAgentsQuery'
import { useInvokeRemoteAgentMutation } from '../../remote-agents/mutations/useInvokeRemoteAgentMutation'
import type { AgentProfile, RemoteAgentProfile } from '../../../shared/types/contracts'

interface MessageComposerProps {
  workspaceId: string
  channelId: string
  onSend: (input: { content: string; userId: string }) => void
}

// Matches a leading @slug mention and captures (slug, remaining text).
const LEADING_MENTION = /^@([a-z0-9_-]+)\s+([\s\S]+)$/i
// Matches an in-progress @slug fragment at the end of the current draft.
const TRAILING_MENTION = /(?:^|\s)@([a-z0-9_-]*)$/i

export function MessageComposer({ workspaceId, channelId, onSend }: MessageComposerProps) {
  const identity = useAuthStore((state) => state.identity)
  const draft = useChatUiStore((state) => state.draftByChannelId[channelId] ?? '')
  const setDraft = useChatUiStore((state) => state.setDraft)
  const clearDraft = useChatUiStore((state) => state.clearDraft)
  const { data: agents = [] } = useAgentsQuery(workspaceId)
  const { data: remoteAgents = [] } = useRemoteAgentsQuery(Boolean(workspaceId))
  const invokeAgent = useInvokeAgentMutation(workspaceId)
  const invokeRemoteAgent = useInvokeRemoteAgentMutation(workspaceId)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const agentsBySlug = useMemo(() => {
    const map = new Map<string, AgentProfile>()
    for (const agent of agents) map.set(agent.slug.toLowerCase(), agent)
    return map
  }, [agents])

  // Only verified, non-unhealthy remote agents are invokable (server enforces too).
  const remoteAgentsBySlug = useMemo(() => {
    const map = new Map<string, RemoteAgentProfile>()
    for (const agent of remoteAgents) {
      if (agent.verificationStatus === 'verified' && agent.healthStatus !== 'unhealthy') {
        map.set(agent.slug.toLowerCase(), agent)
      }
    }
    return map
  }, [remoteAgents])

  const mentionQuery = TRAILING_MENTION.exec(draft)?.[1] ?? null
  const suggestions = useMemo(
    () => (mentionQuery !== null ? filterAgentsByQuery(agents, mentionQuery).slice(0, 6) : []),
    [agents, mentionQuery]
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || !identity) return
    onSend({ content, userId: identity.participantId })
    clearDraft(channelId)
    setShowSuggestions(false)

    const mention = LEADING_MENTION.exec(content)
    if (mention) {
      const slug = mention[1]?.toLowerCase() ?? ''
      const remaining = mention[2]?.trim() ?? ''
      if (remaining) {
        // Internal agents take priority; fall back to a verified remote agent of the same slug.
        const agent = agentsBySlug.get(slug)
        if (agent) {
          invokeAgent.mutate({ agentId: agent.id, content: remaining, channelId })
        } else {
          const remoteAgent = remoteAgentsBySlug.get(slug)
          if (remoteAgent) {
            invokeRemoteAgent.mutate({ id: remoteAgent.id, content: remaining, channelId })
          }
        }
      }
    }
  }

  function applyMention(agent: AgentProfile) {
    const next = draft.replace(TRAILING_MENTION, (match) => {
      const leadingSpace = match.startsWith('@') ? '' : match[0]
      return `${leadingSpace}@${agent.slug} `
    })
    setDraft(channelId, next)
    setShowSuggestions(false)
  }

  function handleChange(value: string) {
    setDraft(channelId, value)
    setShowSuggestions(TRAILING_MENTION.test(value))
  }

  return (
    <form className="message-composer" onSubmit={handleSubmit}>
      {showSuggestions && suggestions.length > 0 ? (
        <MentionSuggestions agents={suggestions} onSelect={applyMention} />
      ) : null}
      <input
        value={draft}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => setShowSuggestions(false)}
        placeholder="메시지를 입력하고 Enter · @에이전트로 멘션"
      />
      <button className="button primary icon-button-send" disabled={!draft.trim() || !identity} type="submit" aria-label="보내기">
        <Send size={18} />
      </button>
    </form>
  )
}
