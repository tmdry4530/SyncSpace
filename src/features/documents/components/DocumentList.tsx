import { NavLink } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { routes } from '../../../app/router/routes'
import { useWorkspaceUiStore } from '../../../shared/stores/workspaceUiStore'
import { useDocumentsQuery } from '../queries/useDocumentsQuery'

export function DocumentList({ workspaceId, onNavigate }: { workspaceId: string; onNavigate?: (() => void) | undefined }) {
  const { data: documents = [], isLoading, error } = useDocumentsQuery(workspaceId)
  const activeChannelId = useWorkspaceUiStore((state) => state.currentChannelId)
  const activeDocumentId = useWorkspaceUiStore((state) => state.currentDocumentId)

  if (isLoading) return <p className="muted">문서 로딩 중...</p>
  if (error) return <p className="form-error">문서를 불러오지 못했습니다.</p>

  return (
    <nav className="nav-list" aria-label="문서 목록">
      {documents.map((document) => (
        <NavLink
          aria-label={`문서 ${document.title}`}
          className={() => (document.id === activeDocumentId ? 'active' : '')}
          key={document.id}
          onClick={onNavigate}
          title={document.title}
          to={activeChannelId ? routes.workbench(workspaceId, activeChannelId, document.id) : routes.document(workspaceId, document.id)}
        >
          <FileText aria-hidden="true" size={16} />
          <span className="nav-label">{document.title}</span>
        </NavLink>
      ))}
      {documents.length === 0 ? <p className="muted">문서 없음</p> : null}
    </nav>
  )
}
