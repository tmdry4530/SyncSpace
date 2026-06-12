import type { AgentStatusEvent } from '../../../../shared/types/engineeringEvents'

interface Props {
  event: AgentStatusEvent
}

export function AgentStatusRenderer({ event }: Props) {
  return (
    <div className="renderer-agent-status">
      <div className="agent-status-card">
        <div className="agent-status-row">
          <span className="agent-status-label">Agent</span>
          <span className="agent-status-value mono">{event.agentId}</span>
        </div>
        <div className="agent-status-row">
          <span className="agent-status-label">Role</span>
          <span className="agent-status-value">{event.role}</span>
        </div>
        <div className="agent-status-row">
          <span className="agent-status-label">Status</span>
          <span className={`roster-status roster-status--${event.status}`}>{event.status}</span>
        </div>
        <div className="agent-status-row">
          <span className="agent-status-label">Action</span>
          <span className="agent-status-value agent-status-action">{event.currentAction}</span>
        </div>
        {event.path && (
          <div className="agent-status-row">
            <span className="agent-status-label">Path</span>
            <span className="agent-status-value mono">{event.path}</span>
          </div>
        )}
      </div>
      <RawInspect event={event} />
    </div>
  )
}

function RawInspect({ event }: { event: AgentStatusEvent }) {
  return (
    <details className="raw-inspect">
      <summary className="raw-inspect-toggle">raw JSON</summary>
      <pre className="event-detail-raw">{JSON.stringify(event, null, 2)}</pre>
    </details>
  )
}
