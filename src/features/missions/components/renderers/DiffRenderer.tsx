import type { FileEditEvent } from '../../../../shared/types/engineeringEvents'
import { RawInspect } from './RawInspect'

interface DiffLine {
  type: 'added' | 'removed' | 'hunk' | 'context' | 'blank'
  content: string
}

function parseDiff(raw: string): DiffLine[] {
  if (!raw || raw.trim() === '') return []
  return raw.split('\n').map((line): DiffLine => {
    if (line.startsWith('+') && !line.startsWith('+++')) return { type: 'added', content: line }
    if (line.startsWith('-') && !line.startsWith('---')) return { type: 'removed', content: line }
    if (line.startsWith('@@')) return { type: 'hunk', content: line }
    if (line.trim() === '') return { type: 'blank', content: line }
    return { type: 'context', content: line }
  })
}

interface Props {
  event: FileEditEvent
}

export function DiffRenderer({ event }: Props) {
  const lines = parseDiff(event.unifiedDiff ?? '')
  const additions = event.additions ?? 0
  const deletions = event.deletions ?? 0

  return (
    <div className="renderer-file-edit">
      <div className="ap-md-diff-head">
        <span className="ap-md-diff-path">{event.path}</span>
        <div className="ap-md-diff-counts">
          {additions > 0 && <span className="ap-md-diff-count--add">+{additions}</span>}
          {deletions > 0 && <span className="ap-md-diff-count--del">−{deletions}</span>}
        </div>
      </div>
      {event.summary && <p className="ap-md-summary">{event.summary}</p>}
      {lines.length === 0 ? (
        <p className="ap-md-empty">통합 diff 없음</p>
      ) : (
        <div className="ap-md-diff-view" role="region" aria-label="unified diff">
          {lines.map((line, i) => (
            <div
              key={i}
              className={`ap-md-diff-line ap-md-diff-line--${line.type}`}
              aria-hidden={line.type === 'blank'}
            >
              {line.content}
            </div>
          ))}
        </div>
      )}
      <RawInspect event={event} />
    </div>
  )
}
