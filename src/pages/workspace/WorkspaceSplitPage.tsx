import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { EyeOff } from 'lucide-react'
import { ChatPanel } from '../../features/chat/components/ChatPanel'
import { useChannelsQuery } from '../../features/channel/queries/useChannelsQuery'
import { EditorPanel } from '../../features/editor/components/EditorPanel'
import { useDocumentsQuery } from '../../features/documents/queries/useDocumentsQuery'
import { usePresenceUiStore } from '../../shared/stores/presenceStore'
import { useWorkspaceUiStore } from '../../shared/stores/workspaceUiStore'
import '../../styles/apple/workbench.css'

export function WorkspaceSplitPage() {
  const { workspaceId, channelId, documentId } = useParams()
  const rememberedChannelId = useWorkspaceUiStore((state) => state.currentChannelId)
  const rememberedDocumentId = useWorkspaceUiStore((state) => state.currentDocumentId)
  const setChannelId = useWorkspaceUiStore((state) => state.setCurrentChannelId)
  const setDocumentId = useWorkspaceUiStore((state) => state.setCurrentDocumentId)
  const presenceCount = usePresenceUiStore((state) => state.states.length)
  const { data: channels = [], isLoading: channelsLoading } = useChannelsQuery(workspaceId)
  const { data: documents = [], isLoading: documentsLoading } = useDocumentsQuery(workspaceId)
  const [bannerDismissed, setBannerDismissed] = useState(() => readHelpDismissed())
  const [chatWidth, setChatWidth] = useState(40)
  const [isDragging, setIsDragging] = useState(false)
  const [activeMobilePane, setActiveMobilePane] = useState<'chat' | 'document'>('chat')

  const preferredChannelId = channelId ?? rememberedChannelId
  const preferredDocumentId = documentId ?? rememberedDocumentId

  const selectedChannel = useMemo(() => {
    if (preferredChannelId) {
      const preferred = channels.find((channel) => channel.id === preferredChannelId)
      if (preferred) return preferred
    }
    return channels[0] ?? null
  }, [channels, preferredChannelId])

  const selectedDocument = useMemo(() => {
    if (preferredDocumentId) {
      const preferred = documents.find((document) => document.id === preferredDocumentId)
      if (preferred) return preferred
    }
    return documents[0] ?? null
  }, [documents, preferredDocumentId])

  const selectedChannelId = selectedChannel?.id ?? null
  const selectedDocumentId = selectedDocument?.id ?? null

  useEffect(() => {
    if (selectedChannelId && selectedChannelId !== rememberedChannelId) setChannelId(selectedChannelId)
  }, [rememberedChannelId, selectedChannelId, setChannelId])

  useEffect(() => {
    if (selectedDocumentId && selectedDocumentId !== rememberedDocumentId) setDocumentId(selectedDocumentId)
  }, [rememberedDocumentId, selectedDocumentId, setDocumentId])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) return
      const container = document.querySelector('.split-workbench')
      if (!container) return
      const rect = container.getBoundingClientRect()
      const newPercentage = ((event.clientX - rect.left) / rect.width) * 100
      if (newPercentage > 24 && newPercentage < 68) setChatWidth(newPercentage)
    }

    const handleMouseUp = () => setIsDragging(false)

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  if (!workspaceId) return <div className="page-state">워크스페이스 경로가 올바르지 않습니다.</div>

  const isLoading = channelsLoading || documentsLoading
  const unifiedStatus = getWorkspaceRealtimeStatus(isLoading)
  const statusLabel = getConnectionStatusLabel(unifiedStatus)

  function dismissWorkbenchHelp() {
    window.localStorage.setItem('syncspace.workbenchHelpDismissed', 'true')
    setBannerDismissed(true)
  }

  const docTitle = selectedDocument?.title ?? '문서'
  const channelLabel = selectedChannel ? `#${selectedChannel.name}` : '채팅'
  // The mock chat column sits on the right at 320px; the resizer adjusts chatWidth
  // (a left-anchored percentage). Feed the inverse so the divider still tracks the drag.
  const chatColWidth = `${Math.max(24, Math.min(56, 100 - chatWidth))}%`

  return (
    <section className="workspace-canvas ap-wb-canvas" aria-label="채팅과 문서 동시 협업 화면">
      <div className="ap-wb-intro">
        <p className="ap-wb-eyebrow">04 · 워크벤치</p>
        <h2>문서 우위 · 타입 주도</h2>
        {!bannerDismissed ? <p>채팅에서 결정하고, 같은 화면의 문서에서 바로 정리하세요.</p> : null}
      </div>

      <div className="ap-wb-frame">
        <div className="ap-wb-topbar">
          <div className="ap-wb-topbar-title">
            <span className="ap-wb-topbar-tag">워크벤치</span>
            <span className="ap-wb-topbar-name">
              {channelLabel} · {docTitle}
            </span>
          </div>
          <div className="ap-wb-topbar-actions">
            <span
              className={`ap-wb-presence-pill is-${unifiedStatus}`}
              aria-label={`${statusLabel}, ${presenceCount}명 접속 중`}
            >
              <span className="ap-wb-dot" aria-hidden="true" />
              {presenceCount > 0 ? `${presenceCount}명 접속 중` : statusLabel}
            </span>
            {!bannerDismissed ? (
              <button className="ap-wb-dismiss" onClick={dismissWorkbenchHelp} type="button">
                <EyeOff size={14} />
                안내 숨기기
              </button>
            ) : null}
          </div>
        </div>

        <div className="ap-wb-mobile-switch" role="tablist" aria-label="모바일 작업 패널 선택">
          <button
            className={activeMobilePane === 'document' ? 'is-active' : ''}
            onClick={() => setActiveMobilePane('document')}
            type="button"
            role="tab"
            aria-selected={activeMobilePane === 'document'}
          >
            문서
          </button>
          <button
            className={activeMobilePane === 'chat' ? 'is-active' : ''}
            onClick={() => setActiveMobilePane('chat')}
            type="button"
            role="tab"
            aria-selected={activeMobilePane === 'chat'}
          >
            채팅
          </button>
        </div>

        <div className="split-workbench ap-wb-body" style={{ ['--ap-wb-chat-w' as string]: chatColWidth }}>
          <div className={`split-pane doc-side ap-wb-pane ap-wb-pane--doc ${activeMobilePane === 'document' ? 'mobile-active is-mobile-active' : ''}`}>
            {selectedDocumentId ? (
              <EditorPanel
                workspaceId={workspaceId}
                documentId={selectedDocumentId}
                documentTitle={selectedDocument?.title}
                documents={documents}
                hideStatus
                variant="workbench"
                readOnly
              />
            ) : (
              <EmptySplitPane title="문서가 없습니다" copy="에이전트가 첫 문서를 만들면 이곳에서 관전할 수 있습니다." loading={isLoading} />
            )}
          </div>

          <button
            className={`resizer ap-wb-resizer ${isDragging ? 'dragging is-dragging' : ''}`}
            onMouseDown={() => setIsDragging(true)}
            type="button"
            aria-label="문서와 채팅 패널 너비 조절"
          />

          <div className={`split-pane chat-side ap-wb-pane ap-wb-pane--chat ${activeMobilePane === 'chat' ? 'mobile-active is-mobile-active' : ''}`}>
            {selectedChannelId ? (
              <ChatPanel
                workspaceId={workspaceId}
                channelId={selectedChannelId}
                channelName={selectedChannel?.name}
                hideStatus
                variant="workbench"
                readOnly
              />
            ) : (
              <EmptySplitPane title="채널이 없습니다" copy="에이전트가 첫 채널을 만들면 이곳에서 관전할 수 있습니다." loading={isLoading} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

type WorkspaceRealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

function getWorkspaceRealtimeStatus(isLoading: boolean): WorkspaceRealtimeStatus {
  return isLoading ? 'connecting' : 'connected'
}

function getConnectionStatusLabel(status: WorkspaceRealtimeStatus): string {
  if (status === 'connected') return '실시간 연결 중'
  if (status === 'connecting') return '연결 중'
  if (status === 'disconnected') return '연결 끊김'
  return '연결 대기'
}

function readHelpDismissed(): boolean {
  try {
    return window.localStorage.getItem('syncspace.workbenchHelpDismissed') === 'true'
  } catch {
    return false
  }
}

function EmptySplitPane({ title, copy, loading }: { title: string; copy: string; loading: boolean }) {
  return (
    <div className="empty-split-pane ap-wb-empty-pane">
      <p className="ap-wb-eyebrow">{loading ? 'LOADING' : 'EMPTY'}</p>
      <h2>{loading ? '불러오는 중...' : title}</h2>
      <p>{loading ? '워크스페이스 항목을 확인하고 있습니다.' : copy}</p>
    </div>
  )
}
