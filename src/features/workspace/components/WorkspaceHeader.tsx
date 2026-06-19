import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { routes } from '../../../app/router/routes'
import { logout } from '../../../shared/api/authApi'
import { useAuthStore } from '../../../shared/stores/authStore'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { useWorkspacesQuery } from '../queries/useWorkspacesQuery'
import { Copy, Check, LogOut, LayoutGrid, User, KeyRound, ChevronDown, Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '../../../shared/hooks/useTheme'

export function WorkspaceHeader({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate()
  const { data: workspaces = [] } = useWorkspacesQuery()
  const user = useAuthStore((state) => state.user)
  const reset = useAuthStore((state) => state.reset)
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const themeLabel = theme === 'system' ? '시스템' : theme === 'light' ? '라이트' : '다크'
  const workspace = workspaces.find((item) => item.id === workspaceId)
  const displayName = formatDisplayName(user?.displayName ?? user?.email)
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
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setInviteOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  async function signOut() {
    try {
      await logout()
    } finally {
      reset()
      navigate(routes.login, { replace: true })
    }
  }

  async function copyInviteCode() {
    if (!workspace?.inviteCode) return
    await writeClipboard(workspace.inviteCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <header className="ap-shell-header">
      <div className="ap-shell-header-brand">
        <p className="ap-shell-eyebrow">현재 워크스페이스</p>
        <div className="ap-shell-ws-trigger" aria-label="현재 워크스페이스">
          <h2>{workspace?.name ?? '워크스페이스'}</h2>
        </div>
      </div>

      <div className="ap-shell-actions">
        <button
          type="button"
          className="ap-shell-icon-btn"
          onClick={() => setTheme(nextTheme)}
          aria-label={`테마: ${themeLabel} (클릭하여 변경)`}
          title={`테마: ${themeLabel}`}
        >
          <ThemeIcon size={16} aria-hidden="true" />
        </button>

        {workspace?.inviteCode && (
          <div className="ap-shell-dropdown" ref={inviteRef}>
            <button
              className={inviteOpen ? 'ap-shell-pill-btn open' : 'ap-shell-pill-btn'}
              onClick={() => setInviteOpen(!inviteOpen)}
              aria-expanded={inviteOpen}
              aria-haspopup="true"
              aria-label="초대 코드 보기"
              type="button"
            >
              <KeyRound size={13} aria-hidden="true" />
              <span>초대 코드</span>
              <ChevronDown size={13} aria-hidden="true" />
            </button>
            {inviteOpen && (
              <div className="ap-shell-menu">
                <div className="ap-shell-menu-header">팀원 초대 코드</div>
                <div className="ap-shell-invite-box">
                  <span className="ap-shell-invite-code">{workspace.inviteCode}</span>
                  <button
                    className="ap-shell-mini-btn"
                    onClick={copyInviteCode}
                    type="button"
                    aria-label="초대 코드 복사"
                  >
                    {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <Link className="ap-shell-pill-btn" to={routes.workspaces}>
          <LayoutGrid size={13} aria-hidden="true" />
          <span>워크스페이스 목록</span>
        </Link>

        <div className="ap-shell-dropdown" ref={menuRef}>
          <button
            className="ap-shell-agent-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-haspopup="true"
            aria-label="사용자 메뉴"
            type="button"
          >
            <span className="user-chip" style={{ ['--chip-color' as string]: user?.color ?? '#94a3b8' }}>
              <User size={14} style={{ marginRight: '6px' }} aria-hidden="true" />
              {displayName}
            </span>
          </button>

          {menuOpen && (
            <div className="ap-shell-menu">
              <div className="ap-shell-menu-item ap-shell-user-info">
                <strong>{displayName}</strong>
                <small>{user?.email}</small>
              </div>
              <div className="ap-shell-menu-divider"></div>
              <button className="ap-shell-menu-item text-danger" onClick={signOut} type="button">
                <LogOut size={16} aria-hidden="true" />
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
