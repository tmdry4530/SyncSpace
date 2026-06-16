import type { ReviewCommentEvent } from '../../../../shared/types/engineeringEvents'
import { RawInspect } from './RawInspect'

interface Props {
  event: ReviewCommentEvent
}

const SEVERITY_CLASS: Record<ReviewCommentEvent['severity'], string> = {
  info: 'ap-md-sev--info',
  warn: 'ap-md-sev--warn',
  error: 'ap-md-sev--error'
}

const VERDICT_CLASS: Record<NonNullable<ReviewCommentEvent['verdict']>, string> = {
  approve: 'ap-md-verdict--approve',
  request_changes: 'ap-md-verdict--request'
}

const VERDICT_LABEL: Record<NonNullable<ReviewCommentEvent['verdict']>, string> = {
  approve: 'approve',
  request_changes: 'request changes'
}

export function ReviewCommentRenderer({ event }: Props) {
  const lineRange =
    event.lineStart != null
      ? event.lineEnd != null && event.lineEnd !== event.lineStart
        ? `${event.lineStart}–${event.lineEnd}`
        : `${event.lineStart}`
      : null

  return (
    <div className="renderer-review-comment">
      <div className="ap-md-card">
        <div className="ap-md-review-head">
          <div className="ap-md-review-loc">
            <span>{event.path}</span>
            {lineRange && <span className="ap-md-review-line">:{lineRange}</span>}
          </div>
          <div className="ap-md-review-badges">
            <span className={`ap-md-sev ${SEVERITY_CLASS[event.severity]}`}>
              {event.severity}
            </span>
            {event.verdict && (
              <span className={`ap-md-verdict ${VERDICT_CLASS[event.verdict]}`}>
                {VERDICT_LABEL[event.verdict]}
              </span>
            )}
          </div>
        </div>
        <p className="ap-md-review-text">{event.comment}</p>
      </div>
      <RawInspect event={event} />
    </div>
  )
}
