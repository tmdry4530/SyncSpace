import type { EngineeringTaskEvent } from '../hooks/useMissionQuery'
import type { EngineeringEvent } from '../../../shared/types/engineeringEvents'

function FieldList({ fields }: { fields: Array<{ label: string; value: string | number | undefined | null }> }) {
  const visible = fields.filter((f) => f.value != null && f.value !== '')
  if (visible.length === 0) return <p className="mission-empty-note">필드 없음</p>
  return (
    <dl className="event-detail-fields">
      {visible.map(({ label, value }) => (
        <div key={label} className="event-detail-field">
          <dt>{label}</dt>
          <dd>{String(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function renderEventBody(eng: EngineeringEvent) {
  switch (eng.kind) {
    case 'agent_status':
      return (
        <FieldList
          fields={[
            { label: 'Agent ID', value: eng.agentId },
            { label: 'Role', value: eng.role },
            { label: 'Status', value: eng.status },
            { label: 'Current Action', value: eng.currentAction },
            { label: 'Path', value: eng.path }
          ]}
        />
      )
    case 'pipeline_stage':
      return (
        <FieldList
          fields={[
            { label: 'Stage', value: eng.stage },
            { label: 'Status', value: eng.status },
            { label: 'Summary', value: eng.summary },
            { label: 'Started', value: eng.startedAt },
            { label: 'Ended', value: eng.endedAt }
          ]}
        />
      )
    case 'file_edit':
      return (
        <>
          <FieldList
            fields={[
              { label: 'Path', value: eng.path },
              { label: 'Summary', value: eng.summary },
              { label: 'Additions', value: eng.additions },
              { label: 'Deletions', value: eng.deletions }
            ]}
          />
          <pre className="event-detail-raw">{eng.unifiedDiff}</pre>
        </>
      )
    case 'command_run':
      return (
        <>
          <FieldList
            fields={[
              { label: 'Command', value: eng.command },
              { label: 'CWD', value: eng.cwd },
              { label: 'Status', value: eng.status },
              { label: 'Exit Code', value: eng.exitCode }
            ]}
          />
          {eng.stdoutTail ? <pre className="event-detail-raw">{eng.stdoutTail}</pre> : null}
          {eng.stderrTail ? <pre className="event-detail-raw event-detail-raw--err">{eng.stderrTail}</pre> : null}
        </>
      )
    case 'test_result':
      return (
        <>
          <FieldList
            fields={[
              { label: 'Suite', value: eng.suite },
              { label: 'Status', value: eng.status },
              { label: 'Passed', value: eng.passed },
              { label: 'Failed', value: eng.failed },
              { label: 'Duration (ms)', value: eng.durationMs }
            ]}
          />
          {eng.failures && eng.failures.length > 0 ? (
            <ul className="event-detail-failures">
              {eng.failures.map((f, i) => (
                <li key={i}>
                  <strong>{f.name}</strong>
                  {f.message ? <p>{f.message}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )
    case 'review_comment':
      return (
        <FieldList
          fields={[
            { label: 'Path', value: eng.path },
            { label: 'Lines', value: eng.lineStart != null ? `${eng.lineStart}–${eng.lineEnd ?? eng.lineStart}` : undefined },
            { label: 'Severity', value: eng.severity },
            { label: 'Verdict', value: eng.verdict },
            { label: 'Comment', value: eng.comment }
          ]}
        />
      )
    case 'vcs_event':
      return (
        <FieldList
          fields={[
            { label: 'Action', value: eng.action },
            { label: 'Branch', value: eng.branch },
            { label: 'Commit SHA', value: eng.commitSha },
            { label: 'PR URL', value: eng.prUrl },
            { label: 'Summary', value: eng.summary }
          ]}
        />
      )
    default:
      // Safe fallback: raw JSON
      return <pre className="event-detail-raw">{JSON.stringify(eng, null, 2)}</pre>
  }
}

interface EventDetailProps {
  event: EngineeringTaskEvent | null
}

export function EventDetail({ event }: EventDetailProps) {
  if (!event) {
    return (
      <section className="mission-event-detail mission-event-detail--empty" aria-label="이벤트 상세">
        <p className="mission-empty-note">타임라인에서 이벤트를 선택하세요.</p>
      </section>
    )
  }

  const eng = event.engineeringEvent
  return (
    <section className="mission-event-detail" aria-label="이벤트 상세">
      <header className="event-detail-header">
        <p className="eyebrow">{eng.kind.replace(/_/g, ' ')}</p>
        {eng.demo ? <span className="demo-badge">demo</span> : null}
        <time className="event-detail-time" dateTime={event.createdAt} title={event.createdAt}>
          {new Date(event.createdAt).toLocaleString('ko-KR')}
        </time>
        <span className="event-detail-seq">#{event.seq}</span>
      </header>
      <div className="event-detail-body">{renderEventBody(eng)}</div>
    </section>
  )
}
