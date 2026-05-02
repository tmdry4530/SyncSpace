import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, LayoutGrid, CornerDownLeft, PanelLeftOpen, X } from 'lucide-react'
import { routes } from '../../../app/router/routes'
import { ChannelList } from '../../channel/components/ChannelList'
import { DocumentList } from '../../documents/components/DocumentList'
import { useCreateChannelMutation } from '../../channel/queries/useCreateChannelMutation'
import { useCreateDocumentMutation } from '../../documents/queries/useCreateDocumentMutation'
import { toAppError } from '../../../shared/api/errors'
import { useSidebarStore } from '../../../shared/stores/sidebarStore'
import { useWorkspaceUiStore } from '../../../shared/stores/workspaceUiStore'

interface SidebarProps {
  workspaceId: string
  onMobileClose?: () => void
}

export function Sidebar({ workspaceId, onMobileClose }: SidebarProps) {
  const navigate = useNavigate()
  const isCollapsed = useSidebarStore((state) => state.isCollapsed)
  const toggleCollapsed = useSidebarStore((state) => state.toggleCollapsed)
  const activeChannelId = useWorkspaceUiStore((state) => state.currentChannelId)
  const activeDocumentId = useWorkspaceUiStore((state) => state.currentDocumentId)
  const createChannel = useCreateChannelMutation(workspaceId)
  const createDocument = useCreateDocumentMutation(workspaceId)
  const [channelName, setChannelName] = useState('')
  const [documentTitle, setDocumentTitle] = useState('')
  const [showChannelInput, setShowChannelInput] = useState(false)
  const [showDocumentInput, setShowDocumentInput] = useState(false)
  const channelError = createChannel.error ? toAppError(createChannel.error).message : null
  const documentError = createDocument.error ? toAppError(createDocument.error).message : null

  function submitChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!channelName.trim()) return
    createChannel.mutate(
      { name: channelName.trim() },
      {
        onSuccess: (channel) => {
          setChannelName('')
          setShowChannelInput(false)
          navigate(activeDocumentId ? routes.workbench(workspaceId, channel.id, activeDocumentId) : routes.channel(workspaceId, channel.id))
          onMobileClose?.()
        }
      }
    )
  }

  function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!documentTitle.trim()) return
    createDocument.mutate(
      { title: documentTitle.trim() },
      {
        onSuccess: (document) => {
          setDocumentTitle('')
          setShowDocumentInput(false)
          navigate(activeChannelId ? routes.workbench(workspaceId, activeChannelId, document.id) : routes.document(workspaceId, document.id))
          onMobileClose?.()
        }
      }
    )
  }

  function toggleChannelInput() {
    if (isCollapsed) {
      toggleCollapsed()
      setShowChannelInput(true)
      return
    }
    setShowChannelInput(!showChannelInput)
  }

  function toggleDocumentInput() {
    if (isCollapsed) {
      toggleCollapsed()
      setShowDocumentInput(true)
      return
    }
    setShowDocumentInput(!showDocumentInput)
  }

  return (
    <aside className={isCollapsed ? 'sidebar collapsed' : 'sidebar'}>
      <div className="sidebar-brand">
        <Link className="brand-lockup" to={routes.workspace(workspaceId)} onClick={onMobileClose}>
          <span className="brand-icon" aria-hidden="true">S</span>
          <span className="brand-wordmark">SyncSpace</span>
        </Link>
        {onMobileClose ? (
          <button className="mobile-sidebar-close" onClick={onMobileClose} type="button" aria-label="사이드바 닫기">
            <X size={18} />
            닫기
          </button>
        ) : null}
        <button className="collapse-button" onClick={toggleCollapsed} type="button" aria-label={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}>
          {isCollapsed ? <PanelLeftOpen size={18} /> : <ChevronLeft size={18} />}
          <span>{isCollapsed ? '펼치기' : '접기'}</span>
        </button>
      </div>
      <div className="sidebar-content">
          <div className="sidebar-section sidebar-home">
            <Link aria-label="워크스페이스 홈" className="sidebar-workspace-link" title="워크스페이스" to={routes.workspace(workspaceId)} onClick={onMobileClose}>
              <LayoutGrid aria-hidden="true" size={16} />
              <span className="nav-label">워크스페이스</span>
            </Link>
          </div>
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <p className="eyebrow">채널</p>
              <button className="icon-button small sidebar-add-btn" onClick={toggleChannelInput} aria-label="채널 추가" type="button">
                <Plus size={16} />
              </button>
            </div>
            <ChannelList workspaceId={workspaceId} onNavigate={onMobileClose} />
            {showChannelInput && (
              <form className="inline-create" onSubmit={submitChannel}>
                <input value={channelName} onChange={(event) => setChannelName(event.target.value)} placeholder="새 채널 이름" autoFocus />
                <button disabled={createChannel.isPending} type="submit" aria-label="만들기">
                  <CornerDownLeft size={16} />
                </button>
              </form>
            )}
            {channelError ? <p className="form-error compact" role="alert">채널 생성 실패: {channelError}</p> : null}
          </div>
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <p className="eyebrow">문서</p>
              <button className="icon-button small sidebar-add-btn" onClick={toggleDocumentInput} aria-label="문서 추가" type="button">
                <Plus size={16} />
              </button>
            </div>
            <DocumentList workspaceId={workspaceId} onNavigate={onMobileClose} />
            {showDocumentInput && (
              <form className="inline-create" onSubmit={submitDocument}>
                <input data-document-title-input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="새 문서 이름" autoFocus />
                <button disabled={createDocument.isPending} type="submit" aria-label="만들기">
                  <CornerDownLeft size={16} />
                </button>
              </form>
            )}
            {documentError ? <p className="form-error compact" role="alert">문서 생성 실패: {documentError}</p> : null}
          </div>
      </div>
    </aside>
  )
}
