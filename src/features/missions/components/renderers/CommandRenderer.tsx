import type { CommandRunEvent } from '../../../../shared/types/engineeringEvents'
import { RawInspect } from './RawInspect'

interface Props {
  event: CommandRunEvent
}

// Maps the command run status onto the dark terminal-footer status modifier
// (success / running / failed) — the footer stays dark in both themes.
const TERM_STATUS_CLASS: Record<CommandRunEvent['status'], string> = {
  running: 'ap-md-term-status--running',
  success: 'ap-md-term-status--success',
  failed: 'ap-md-term-status--failed'
}

export function CommandRenderer({ event }: Props) {
  return (
    <div className="renderer-command-run">
      <div className="ap-md-terminal">
        <div className="ap-md-terminal-body">
          {event.cwd && <div className="ap-md-term-cwd">{event.cwd}</div>}
          <div className="ap-md-term-prompt">
            <span className="ap-md-term-dollar">$</span> {event.command}
          </div>
          {event.stdoutTail && (
            <pre className="ap-md-term-out">
              <span className="ap-md-term-out-label">stdout</span>
              {event.stdoutTail}
            </pre>
          )}
          {event.stderrTail && (
            <pre className="ap-md-term-out ap-md-term-out--err">
              <span className="ap-md-term-out-label">stderr</span>
              {event.stderrTail}
            </pre>
          )}
        </div>
        <div className="ap-md-terminal-footer">
          <span className={`ap-md-term-status ${TERM_STATUS_CLASS[event.status]}`}>
            {event.status}
          </span>
          {event.exitCode != null && (
            <span className="ap-md-term-exit">exit {event.exitCode}</span>
          )}
        </div>
      </div>
      <RawInspect event={event} />
    </div>
  )
}
