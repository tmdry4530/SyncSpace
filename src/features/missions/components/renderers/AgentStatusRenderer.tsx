import type { AgentStatusEvent } from '../../../../shared/types/engineeringEvents'
import { RawInspect } from './RawInspect'

interface Props {
  event: AgentStatusEvent
}

export function AgentStatusRenderer({ event }: Props) {
  return (
    <div className="renderer-agent-status">
      <div className="ap-md-card">
        <div className="ap-md-kv">
          <span className="ap-md-kv-label">Agent</span>
          <span className="ap-md-kv-value mono">{event.agentId}</span>
        </div>
        <div className="ap-md-kv">
          <span className="ap-md-kv-label">Role</span>
          <span className="ap-md-kv-value">{event.role}</span>
        </div>
        <div className="ap-md-kv">
          <span className="ap-md-kv-label">Status</span>
          <span className={`ap-md-roster-status ap-md-roster-status--${event.status}`}>
            {event.status}
          </span>
        </div>
        <div className="ap-md-kv">
          <span className="ap-md-kv-label">Action</span>
          <span className="ap-md-kv-value">{event.currentAction}</span>
        </div>
        {event.path && (
          <div className="ap-md-kv">
            <span className="ap-md-kv-label">Path</span>
            <span className="ap-md-kv-value mono">{event.path}</span>
          </div>
        )}
      </div>
      <RawInspect event={event} />
    </div>
  )
}
