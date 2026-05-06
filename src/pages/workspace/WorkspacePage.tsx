import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { routes } from '../../app/router/routes'
import { useCreateWorkspaceMutation } from '../../features/workspace/queries/useCreateWorkspaceMutation'
import { useJoinWorkspaceMutation } from '../../features/workspace/queries/useJoinWorkspaceMutation'
import { useWorkspacesQuery } from '../../features/workspace/queries/useWorkspacesQuery'
import { getSupabaseClient } from '../../shared/api/supabaseClient'
import { toAppError } from '../../shared/api/errors'
import { useAuthStore } from '../../shared/stores/authStore'
import { formatDisplayName } from '../../shared/utils/displayName'

export function WorkspacePage() {
  const navigate = useNavigate()
  const profile = useAuthStore((state) => state.profile)
  const user = useAuthStore((state) => state.user)
  const { data: workspaces = [], isLoading, error } = useWorkspacesQuery()
  const createWorkspace = useCreateWorkspaceMutation()
  const joinWorkspace = useJoinWorkspaceMutation()
  const [name, setName] = useState('SyncSpace Demo')
  const [inviteCode, setInviteCode] = useState('')

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return
    createWorkspace.mutate(
      { name: name.trim() },
      {
        onSuccess: (workspace) => {
          setName('')
          navigate(routes.workspace(workspace.id))
        }
      }
    )
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!inviteCode.trim()) return
    joinWorkspace.mutate(
      { inviteCode },
      {
        onSuccess: (workspace) => {
          setInviteCode('')
          navigate(routes.workspace(workspace.id))
        }
      }
    )
  }

  async function signOut() {
    await getSupabaseClient()?.auth.signOut()
  }

  const createError = createWorkspace.error ? toAppError(createWorkspace.error).message : null
  const joinError = joinWorkspace.error ? toAppError(joinWorkspace.error).message : null
  const loadError = error ? toAppError(error).message : null
  const displayName = formatDisplayName(profile?.displayName ?? user?.email)

  return (
    <main className="workspace-index">
      <header className="workspace-index-topbar">
        <Link className="brand-lockup" to={routes.home}>
          <span className="brand-icon" aria-hidden="true">S</span>
          <span>SyncSpace</span>
        </Link>
        <div className="workspace-index-user">
          <span>{user?.email ?? profile?.displayName ?? '사용자'}</span>
          <button className="link-button" onClick={signOut} type="button">로그아웃</button>
        </div>
      </header>

      <section className="workspace-index-content">
        <div className="workspace-index-list">
          <div className="section-header workspace-index-header">
            <p className="eyebrow">MY WORKSPACES</p>
            <h1>다시 오신 것을 환영합니다</h1>
            <p className="muted">계속 작업할 워크스페이스를 선택하세요.</p>
          </div>

          {isLoading ? <p className="page-state">워크스페이스 불러오는 중...</p> : null}
          {loadError ? <p className="form-error" role="alert">워크스페이스를 불러오지 못했습니다: {loadError}</p> : null}

          <section className="workspace-focus-card" aria-label="워크스페이스 시작 요약">
            <div>
              <p className="eyebrow">오늘의 작업대</p>
              <h2>{displayName}님의 협업 공간</h2>
              <p>
                채팅과 문서를 한 화면에 고정해두고 작업을 이어가세요.
                워크스페이스가 적어도 바로 다음 행동이 보이도록 정리했습니다.
              </p>
            </div>
            <dl className="workspace-focus-stats">
              <div>
                <dt>보유 공간</dt>
                <dd>{workspaces.length}</dd>
              </div>
              <div>
                <dt>추천 시작</dt>
                <dd>{workspaces.length > 0 ? '입장' : '생성'}</dd>
              </div>
            </dl>
          </section>

          <div className="workspace-grid" aria-label="워크스페이스 목록">
            {workspaces.map((workspace) => (
              <Link className="workspace-tile" key={workspace.id} to={`/w/${workspace.id}`}>
                <span>{workspace.name.slice(0, 2).toUpperCase()}</span>
                <strong>{workspace.name}</strong>
                <small>초대 코드 {workspace.inviteCode}</small>
                <em aria-hidden="true">→</em>
              </Link>
            ))}
            {workspaces.length === 0 && !isLoading ? (
              <div className="empty-workspace-panel">
                <p className="eyebrow">첫 공간 만들기</p>
                <h2>왼쪽 목록이 비어 있어도 흐름은 준비되어 있습니다.</h2>
                <p>이름을 정해 새 공간을 만들거나, 팀원이 준 초대 코드로 합류하세요.</p>
              </div>
            ) : null}
          </div>

          <div className="workspace-starter-strip" aria-label="초기 사용 흐름">
            <span>1. 공간 선택</span>
            <span>2. 채널과 문서 생성</span>
            <span>3. 채팅과 문서 동시 작업</span>
          </div>
        </div>

        <aside className="workspace-action-rail" aria-label="워크스페이스 생성 및 참여">
          <form className="create-card join-card" onSubmit={handleJoin}>
            <div>
              <p className="eyebrow">JOIN</p>
              <h2>워크스페이스 참여</h2>
              <p>팀에서 받은 초대 코드를 입력하세요.</p>
            </div>
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="e.g. SYNC-1234-ABCD"
              aria-label="초대 코드"
            />
            <button className="button primary" disabled={joinWorkspace.isPending} type="submit">
              {joinWorkspace.isPending ? '참여 중...' : '워크스페이스 참여'}
            </button>
            {joinError ? <p className="form-error compact" role="alert">워크스페이스 참여 실패: {joinError}</p> : null}
          </form>

          <div className="rail-separator"><span>또는 새로 만들기</span></div>

          <form className="create-card" onSubmit={handleCreate}>
            <div>
              <p className="eyebrow">CREATE</p>
              <h2>새 워크스페이스 만들기</h2>
            </div>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="새 워크스페이스 이름" />
            <button className="button ghost" disabled={createWorkspace.isPending} type="submit">
              {createWorkspace.isPending ? '만드는 중...' : '워크스페이스 만들기'}
            </button>
            {createError ? <p className="form-error compact" role="alert">워크스페이스 생성 실패: {createError}</p> : null}
          </form>
        </aside>
      </section>
    </main>
  )
}
