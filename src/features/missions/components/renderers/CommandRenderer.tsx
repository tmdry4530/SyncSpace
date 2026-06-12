import type { CommandRunEvent } from '../../../../shared/types/engineeringEvents'

interface Props {
  event: CommandRunEvent
}

const STATUS_CLASS: Record<CommandRunEvent['status'], string> = {
  running: 'status-pill--running',
  success: 'status-pill--success',
  failed: 'status-pill--failed'
}

const STATUS_LABEL: Record<CommandRunEvent['status'], string> = {
  running: 'running',
  success: 'success',
  failed: 'failed'
}

export function CommandRenderer({ event }: Props) {
  return (
    <div className="renderer-command-run">
      <div className="terminal-block">
        <div className="terminal-prompt-line">
          {event.cwd && <span className="terminal-cwd">{event.cwd}</span>}
          <span className="terminal-prompt-char">$</span>
          <span className="terminal-command">{event.command}</span>
        </div>
        <div className="terminal-meta-row">
          <span className={`status-pill ${STATUS_CLASS[event.status]}`}>
            {STATUS_LABEL[event.status]}
          </span>
          {event.exitCode != null && (
            <span className="terminal-exit-code">exit {event.exitCode}</span>
          )}
        </div>
        {event.stdoutTail && (
          <div className="terminal-output terminal-output--stdout">
            <span className="terminal-output-label">stdout</span>
            <pre className="terminal-output-content">{event.stdoutTail}</pre>
          </div>
        )}
        {event.stderrTail && (
          <div className="terminal-output terminal-output--stderr">
            <span className="terminal-output-label">stderr</span>
            <pre className="terminal-output-content">{event.stderrTail}</pre>
          </div>
        )}
      </div>
      <RawInspect event={event} />
    </div>
  )
}

function RawInspect({ event }: { event: CommandRunEvent }) {
  return (
    <details className="raw-inspect">
      <summary className="raw-inspect-toggle">raw JSON</summary>
      <pre className="event-detail-raw">{JSON.stringify(event, null, 2)}</pre>
    </details>
  )
}
