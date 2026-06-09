import type { AgentProfile } from '../../../shared/types/contracts'
import { agentRoleLabel } from '../agentDisplay'

interface MentionSuggestionsProps {
  agents: AgentProfile[]
  onSelect: (agent: AgentProfile) => void
}

export function MentionSuggestions({ agents, onSelect }: MentionSuggestionsProps) {
  if (agents.length === 0) return null

  return (
    <ul className="mention-suggestions" role="listbox" aria-label="에이전트 멘션 추천">
      {agents.map((agent) => (
        <li key={agent.id} role="option" aria-selected={false}>
          <button className="mention-suggestion" onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(agent)} type="button">
            <span className="mention-slug">@{agent.slug}</span>
            <span className="mention-name">{agent.displayName}</span>
            <span className="mention-role">{agentRoleLabel(agent.role)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Filter agents whose slug starts with the given query (case-insensitive). */
export function filterAgentsByQuery(agents: AgentProfile[], query: string): AgentProfile[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return agents
  return agents.filter(
    (agent) => agent.slug.toLowerCase().startsWith(normalized) || agent.displayName.toLowerCase().includes(normalized)
  )
}
