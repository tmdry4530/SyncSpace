import type { VcsEvent } from '../../../../shared/types/engineeringEvents'
import { RawInspect } from './RawInspect'

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

/** Only http(s) URLs may become clickable — payloads are agent-influenced. */
function safePrUrl(url: string | undefined): string | null {
  if (!url || !/^https?:\/\//i.test(url)) return null
  return url
}

export function VcsEventRenderer({ event }: Props) {
  const shortSha = event.commitSha ? event.commitSha.slice(0, 7) : null
  const prUrl = safePrUrl(event.prUrl)

  return (
    <div className="renderer-vcs-event">
      <div className="ap-md-card">
        <div className="ap-md-vcs-row">
          <span className="ap-md-vcs-icon" aria-hidden="true">
            {ACTION_ICON[event.action]}
          </span>
          <span className="ap-md-vcs-label">{ACTION_LABEL[event.action]}</span>
          {event.branch && <span className="ap-md-vcs-branch">{event.branch}</span>}
          {shortSha && (
            <span className="ap-md-vcs-sha" title={event.commitSha}>
              {shortSha}
            </span>
          )}
          {prUrl && (
            <a
              className="ap-md-vcs-pr"
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              PR ↗
            </a>
          )}
          {event.summary && <span className="ap-md-vcs-summary">{event.summary}</span>}
        </div>
      </div>
      <RawInspect event={event} />
    </div>
  )
}
