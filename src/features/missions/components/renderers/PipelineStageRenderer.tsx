import type { PipelineStageEvent } from '../../../../shared/types/engineeringEvents'

interface Props {
  event: PipelineStageEvent
}

const STATUS_CLASS: Record<PipelineStageEvent['status'], string> = {
  pending: 'status-pill--pending',
  active: 'status-pill--running',
  done: 'status-pill--success',
  failed: 'status-pill--failed'
}

export function PipelineStageRenderer({ event }: Props) {
  return (
    <div className="renderer-pipeline-stage">
      <div className="pipeline-detail-card">
        <div className="pipeline-detail-row">
          <span className="pipeline-detail-label">Stage</span>
          <span className="pipeline-detail-value">{event.stage}</span>
        </div>
        <div className="pipeline-detail-row">
          <span className="pipeline-detail-label">Status</span>
          <span className={`status-pill ${STATUS_CLASS[event.status]}`}>{event.status}</span>
        </div>
        {event.summary && (
          <div className="pipeline-detail-row">
            <span className="pipeline-detail-label">Summary</span>
            <span className="pipeline-detail-value">{event.summary}</span>
          </div>
        )}
        {event.startedAt && (
          <div className="pipeline-detail-row">
            <span className="pipeline-detail-label">Started</span>
            <time className="pipeline-detail-value" dateTime={event.startedAt}>
              {new Date(event.startedAt).toLocaleString('ko-KR')}
            </time>
          </div>
        )}
        {event.endedAt && (
          <div className="pipeline-detail-row">
            <span className="pipeline-detail-label">Ended</span>
            <time className="pipeline-detail-value" dateTime={event.endedAt}>
              {new Date(event.endedAt).toLocaleString('ko-KR')}
            </time>
          </div>
        )}
      </div>
      <RawInspect event={event} />
    </div>
  )
}

function RawInspect({ event }: { event: PipelineStageEvent }) {
  return (
    <details className="raw-inspect">
      <summary className="raw-inspect-toggle">raw JSON</summary>
      <pre className="event-detail-raw">{JSON.stringify(event, null, 2)}</pre>
    </details>
  )
}
