import { FileText } from 'lucide-react'
import type { Artifact, Part } from '../../../shared/types/contracts'

interface ArtifactViewerProps {
  artifacts: Artifact[]
}

export function ArtifactViewer({ artifacts }: ArtifactViewerProps) {
  if (artifacts.length === 0) {
    return <p className="agent-empty-note">생성된 산출물이 없습니다.</p>
  }

  return (
    <div className="artifact-list">
      {artifacts.map((artifact) => (
        <article className="artifact-card" key={artifact.artifactId}>
          <header className="artifact-card-header">
            <FileText size={14} aria-hidden="true" />
            <strong>{artifact.name ?? `산출물 ${artifact.artifactId.slice(0, 8)}`}</strong>
          </header>
          {artifact.description ? <p className="artifact-description">{artifact.description}</p> : null}
          <div className="artifact-parts">
            {artifact.parts.map((part, index) => (
              <PartView key={index} part={part} />
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}

export function PartView({ part }: { part: Part }) {
  if (typeof part.text === 'string') {
    return <pre className="artifact-part artifact-text">{part.text}</pre>
  }
  if (part.data) {
    return <pre className="artifact-part artifact-json">{JSON.stringify(part.data, null, 2)}</pre>
  }
  if (part.file) {
    const file = part.file
    const label = file.name ?? file.uri ?? '파일'
    return (
      <div className="artifact-part artifact-file">
        <FileText size={14} aria-hidden="true" />
        {file.uri ? (
          <a href={file.uri} target="_blank" rel="noreferrer">
            {label}
          </a>
        ) : (
          <span>{label}</span>
        )}
        {file.mimeType ? <em>{file.mimeType}</em> : null}
      </div>
    )
  }
  return null
}
