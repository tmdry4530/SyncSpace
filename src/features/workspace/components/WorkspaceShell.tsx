import { useEffect, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { routes } from '../../../app/router/routes'
import { useWorkspaceServerRealtime } from '../../realtime/useServerStateRealtime'
import { useWorkspaceUiStore } from '../../../shared/stores/workspaceUiStore'
import { useSidebarStore } from '../../../shared/stores/sidebarStore'
import { toAppError } from '../../../shared/api/errors'
import { useWorkspacesQuery } from '../queries/useWorkspacesQuery'
import { Sidebar } from './Sidebar'
import { WorkspaceHeader } from './WorkspaceHeader'
import '../../../styles/apple/shell.css'

export function WorkspaceShell() {
  const { workspaceId, channelId, documentId } = useParams()
  const setWorkspaceId = useWorkspaceUiStore((state) => state.setCurrentWorkspaceId)
  const setChannelId = useWorkspaceUiStore((state) => state.setCurrentChannelId)
  const setDocumentId = useWorkspaceUiStore((state) => state.setCurrentDocumentId)
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const isSidebarCollapsed = useSidebarStore((state) => state.isCollapsed)
  const { data: workspaces = [], isLoading, error } = useWorkspacesQuery()
  const workspace = workspaces.find((item) => item.id === workspaceId)
  useWorkspaceServerRealtime(workspaceId)

  useEffect(() => {
    setWorkspaceId(workspaceId ?? null)
    if (channelId) setChannelId(channelId)
    if (documentId) setDocumentId(documentId)
  }, [channelId, documentId, setChannelId, setDocumentId, setWorkspaceId, workspaceId])

  if (!workspaceId) {
    return (
      <div className="ap-shell-state">
        <div className="ap-shell-state-card">
          <p className="ap-shell-state-eyebrow">잘못된 경로</p>
          <h1>워크스페이스 경로가 올바르지 않습니다.</h1>
        </div>
      </div>
    )
  }
  if (isLoading) {
    return (
      <div className="ap-shell-state">
        <div className="ap-shell-state-card">
          <div className="ap-shell-spinner" aria-hidden="true" />
          <p className="ap-shell-state-eyebrow">Verifying access</p>
          <h1>워크스페이스 권한을 확인하는 중…</h1>
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="ap-shell-state">
        <div className="ap-shell-state-card">
          <p className="ap-shell-state-eyebrow">Connection error</p>
          <h1>워크스페이스를 불러오지 못했습니다</h1>
          <p>{toAppError(error).message}</p>
        </div>
      </div>
    )
  }
  if (!workspace) {
    return (
      <div className="ap-shell-state">
        <main className="ap-shell-state-card">
          <p className="ap-shell-state-eyebrow">ACCESS REQUIRED</p>
          <h1>이 워크스페이스에 접근할 수 없습니다</h1>
          <p>로그인한 에이전트의 작업 공간으로 이동합니다.</p>
          <div className="ap-shell-state-actions">
            <Link className="ap-shell-cta ap-shell-cta--primary" to={routes.workspaces}>
              내 작업 공간으로 이동
            </Link>
            <Link className="ap-shell-cta ap-shell-cta--ghost" to={routes.login}>
              다른 에이전트로 로그인
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const shellClassName = [
    'ap-shell-root',
    isMobileSidebarOpen ? 'ap-shell-mobile-open' : null,
    isSidebarCollapsed ? 'ap-shell-collapsed' : null
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClassName}>
      {isMobileSidebarOpen ? (
        <div
          className="ap-shell-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}
      <button className="ap-shell-mobile-trigger" onClick={() => setMobileSidebarOpen(true)} type="button">
        <Menu size={18} aria-hidden="true" />
        메뉴
      </button>
      <Sidebar workspaceId={workspaceId} onMobileClose={() => setMobileSidebarOpen(false)} />
      <section className="ap-shell-main" aria-hidden={isMobileSidebarOpen ? true : undefined}>
        <WorkspaceHeader workspaceId={workspaceId} />
        <div className="ap-shell-outlet">
          <Outlet />
        </div>
      </section>
    </div>
  )
}
