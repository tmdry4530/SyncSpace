import { useParams } from 'react-router-dom'
import { useChannelsQuery } from '../../features/channel/queries/useChannelsQuery'
import { useDocumentsQuery } from '../../features/documents/queries/useDocumentsQuery'

export function WorkspaceOverviewPage() {
  const { workspaceId } = useParams()
  const { data: channels = [] } = useChannelsQuery(workspaceId)
  const { data: documents = [] } = useDocumentsQuery(workspaceId)

  return (
    <section className="workspace-overview">
      <p className="eyebrow">READY TO COLLABORATE</p>
      <h1>채널이나 문서를 선택하세요</h1>
      <p>
        왼쪽 사이드바에서 채널 채팅 또는 문서를 열면 Yjs 기반 실시간 협업 방에 연결됩니다.
        새 워크스페이스라면 사이드바의 입력창으로 첫 채널과 문서를 만들어보세요.
      </p>
      <div className="overview-stats" aria-label="워크스페이스 항목 수">
        <span><strong>{channels.length}</strong> channels</span>
        <span><strong>{documents.length}</strong> documents</span>
      </div>
    </section>
  )
}
