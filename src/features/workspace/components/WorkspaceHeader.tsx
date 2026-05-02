import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { routes } from '../../../app/router/routes'
import { getSupabaseClient } from '../../../shared/api/supabaseClient'
import { useAuthStore } from '../../../shared/stores/authStore'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { useWorkspacesQuery } from '../queries/useWorkspacesQuery'
import { Copy, Check, LogOut, LayoutGrid, User, KeyRound, ChevronDown } from 'lucide-react'

export function WorkspaceHeader({ workspaceId }: { workspaceId: string }) {
  const { data: workspaces = [] } = useWorkspacesQuery()
  const profile = useAuthStore((state) => state.profile)
  const user = useAuthStore((state) => state.user)
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const workspace = workspaces.find((item) => item.id === workspaceId)
  const displayName = formatDisplayName(profile?.displayName ?? user?.email)
  const menuRef = useRef<HTMLDivElement>(null)
  const inviteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
      if (inviteRef.current && !inviteRef.current.contains(event.target as Node)) {
        setInviteOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function signOut() {
    await getSupabaseClient()?.auth.signOut()
  }

  async function copyInviteCode() {
    if (!workspace?.inviteCode) return
    await writeClipboard(workspace.inviteCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <header className="workspace-header">
      <div className="header-brand">
        <p className="eyebrow">현재 워크스페이스</p>
        <h2>{workspace?.name ?? '워크스페이스'}</h2>
      </div>
      
      <div className="header-actions">
        {workspace?.inviteCode && (
          <div className="dropdown-container" ref={inviteRef}>
            <button 
              className={inviteOpen ? 'invite-trigger open' : 'invite-trigger'} 
              onClick={() => setInviteOpen(!inviteOpen)} 
              aria-expanded={inviteOpen}
              aria-label="초대 코드 보기"
              type="button"
            >
              <KeyRound size={16} />
              <span>초대 코드</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {inviteOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-header">팀원 초대 코드</div>
                <div className="invite-box">
                  <span className="invite-code">{workspace.inviteCode}</span>
                  <button className="button ghost small invite-copy-button" onClick={copyInviteCode} type="button" aria-label="초대 코드 복사">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <Link className="workspace-switch-link" to={routes.workspaces}>
          <LayoutGrid size={15} />
          <span>워크스페이스 목록</span>
        </Link>

        <div className="dropdown-container" ref={menuRef}>
          <button 
            className="user-menu-button" 
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label="사용자 메뉴"
            type="button"
          >
            <span className="user-chip" style={{ ['--chip-color' as string]: profile?.color ?? '#94a3b8' }}>
              <User size={14} style={{ marginRight: '6px' }} />
              {displayName}
            </span>
          </button>
          
          {menuOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-item user-info">
                <strong>{displayName}</strong>
                <small>{user?.email}</small>
              </div>
              <div className="dropdown-divider"></div>
              <button className="dropdown-item text-danger" onClick={signOut} type="button">
                <LogOut size={16} />
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Fall back to a temporary textarea below.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}
