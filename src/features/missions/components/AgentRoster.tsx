import type { AgentStatusEvent } from '../../../shared/types/engineeringEvents'

interface AgentRosterProps {
  roster: Map<string, AgentStatusEvent>
}

export function AgentRoster({ roster }: AgentRosterProps) {
  const agents = Array.from(roster.values())

  return (
    <section className="mission-roster" aria-label="에이전트 로스터">
      <p className="eyebrow">에이전트</p>
      {agents.length === 0 ? (
        <p className="mission-empty-note">아직 에이전트 상태가 없습니다.</p>
      ) : (
        <ul className="roster-list">
          {agents.map((agent) => (
            <li key={agent.agentId} className="roster-row">
              <div className="roster-row-header">
                <span className="roster-agent-id">{agent.agentId.slice(0, 10)}</span>
                <span className={`roster-status roster-status--${agent.status}`}>{agent.status}</span>
              </div>
              <span className="roster-role">{agent.role}</span>
              <span className="roster-action">{agent.currentAction}</span>
              {agent.demo ? <span className="demo-badge">demo</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
