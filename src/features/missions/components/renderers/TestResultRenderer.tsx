import type { TestResultEvent } from '../../../../shared/types/engineeringEvents'
import { RawInspect } from './RawInspect'

interface Props {
  event: TestResultEvent
}

export function TestResultRenderer({ event }: Props) {
  const passed = event.passed ?? 0
  const failed = event.failed ?? 0
  const total = passed + failed
  const hasFailed = event.status === 'failed'

  return (
    <div className="renderer-test-result">
      <div className={`ap-md-test-banner ap-md-test-banner--${hasFailed ? 'failed' : 'passed'}`}>
        <span className="ap-md-test-icon" aria-hidden="true">{hasFailed ? '✗' : '✓'}</span>
        <div className="ap-md-test-banner-body">
          <span className="ap-md-test-suite">{event.suite}</span>
          <span className="ap-md-test-verdict">{hasFailed ? 'FAILED' : 'PASSED'}</span>
        </div>
      </div>
      <div className="ap-md-test-stats">
        {total > 0 && (
          <>
            <span className="ap-md-test-stat ap-md-test-stat--pass">{passed} passed</span>
            {failed > 0 && <span className="ap-md-test-stat ap-md-test-stat--fail">{failed} failed</span>}
          </>
        )}
        {event.durationMs != null && (
          <span className="ap-md-test-stat ap-md-test-stat--duration">{event.durationMs} ms</span>
        )}
      </div>
      {event.failures && event.failures.length > 0 && (
        <ul className="ap-md-failures">
          {event.failures.map((f, i) => (
            <li key={i}>
              <strong>{f.name}</strong>
              {f.message ? <p>{f.message}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <RawInspect event={event} />
    </div>
  )
}
