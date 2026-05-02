import { NavLink } from 'react-router-dom'
import { Hash } from 'lucide-react'
import { routes } from '../../../app/router/routes'
import { useWorkspaceUiStore } from '../../../shared/stores/workspaceUiStore'
import { useChannelsQuery } from '../queries/useChannelsQuery'

export function ChannelList({ workspaceId, onNavigate }: { workspaceId: string; onNavigate?: (() => void) | undefined }) {
  const { data: channels = [], isLoading, error } = useChannelsQuery(workspaceId)
  const activeChannelId = useWorkspaceUiStore((state) => state.currentChannelId)
  const activeDocumentId = useWorkspaceUiStore((state) => state.currentDocumentId)

  if (isLoading) return <p className="muted">채널 로딩 중...</p>
  if (error) return <p className="form-error">채널을 불러오지 못했습니다.</p>

  return (
    <nav className="nav-list" aria-label="채널 목록">
      {channels.map((channel) => (
        <NavLink
          aria-label={`채널 ${channel.name}`}
          className={() => (channel.id === activeChannelId ? 'active' : '')}
          key={channel.id}
          onClick={onNavigate}
          title={channel.name}
          to={activeDocumentId ? routes.workbench(workspaceId, channel.id, activeDocumentId) : routes.channel(workspaceId, channel.id)}
        >
          <Hash aria-hidden="true" size={16} />
          <span className="nav-label">{channel.name}</span>
        </NavLink>
      ))}
      {channels.length === 0 ? <p className="muted">채널 없음</p> : null}
    </nav>
  )
}
