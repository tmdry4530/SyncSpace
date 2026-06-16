/** Collapsible raw-JSON inspector shared by every event renderer. */
export function RawInspect({ event }: { event: unknown }) {
  return (
    <details className="ap-md-raw">
      <summary className="ap-md-raw-toggle">raw JSON</summary>
      <pre className="ap-md-raw-pre">{JSON.stringify(event, null, 2)}</pre>
    </details>
  )
}
