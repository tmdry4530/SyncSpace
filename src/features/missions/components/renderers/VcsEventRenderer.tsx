import type { VcsEvent } from '../../../../shared/types/engineeringEvents'

interface Props {
  event: VcsEvent
}

const ACTION_ICON: Record<VcsEvent['action'], string> = {
  branch_created: '⎇',
  commit: '●',
  pr_opened: '⇡'
}

const ACTION_LABEL: Record<VcsEvent['action'], string> = {
  branch_created: 'branch created',
  commit: 'commit',
  pr_opened: 'PR opened'
}

export function VcsEventRenderer({ event }: Props) {
  const shortSha = event.commitSha ? event.commitSha.slice(0, 7) : null

  return (
    <div className="renderer-vcs-event">
      <div className="vcs-row">
        <span className="vcs-action-icon" aria-hidden="true">
          {ACTION_ICON[event.action]}
        </span>
        <span className="vcs-action-label">{ACTION_LABEL[event.action]}</span>
        {event.branch && <span className="vcs-branch">{event.branch}</span>}
        {shortSha && (
          <span className="vcs-sha" title={event.commitSha}>
            {shortSha}
          </span>
        )}
        {event.prUrl && (
          <a
            className="vcs-pr-link"
            href={event.prUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            PR ↗
          </a>
        )}
        {event.summary && <span className="vcs-summary">{event.summary}</span>}
      </div>
      <RawInspect event={event} />
    </div>
  )
}

function RawInspect({ event }: { event: VcsEvent }) {
  return (
    <details className="raw-inspect">
      <summary className="raw-inspect-toggle">raw JSON</summary>
      <pre className="event-detail-raw">{JSON.stringify(event, null, 2)}</pre>
    </details>
  )
}
