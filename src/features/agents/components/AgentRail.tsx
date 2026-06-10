import { Bot } from 'lucide-react'
import { useAgentsQuery } from '../queries/useAgentsQuery'
import { useAgentTasksQuery } from '../queries/useAgentTasksQuery'
import { AgentStatusBadge } from './AgentStatusBadge'
import { AgentTaskList } from './AgentTaskList'
import { agentRoleLabel } from '../agentDisplay'
import { RemoteAgentDirectory } from '../../remote-agents/components/RemoteAgentDirectory'

interface AgentRailProps {
  workspaceId: string
  channelId?: string | null | undefined
  activeTaskId?: string | null
  onSelectTask: (taskId: string) => void
}

export function AgentRail({ workspaceId, channelId, activeTaskId, onSelectTask }: AgentRailProps) {
  const { data: agents = [], isLoading: agentsLoading } = useAgentsQuery(workspaceId)
  const { data: tasks = [], isLoading: tasksLoading } = useAgentTasksQuery(workspaceId)

  return (
    <aside className="agent-rail" aria-label="에이전트 협업 패널">
      <section className="agent-rail-section">
        <h2>
          <Bot size={15} />
          에이전트
        </h2>
        {agentsLoading && agents.length === 0 ? <p className="agent-empty-note">에이전트를 불러오는 중...</p> : null}
        {!agentsLoading && agents.length === 0 ? (
          <p className="agent-empty-note">사용 가능한 에이전트가 없습니다.</p>
        ) : null}
        <ul className="agent-roster">
          {agents.map((agent) => (
            <li className="agent-roster-item" key={agent.id}>
              <span className="agent-avatar" aria-hidden="true">
                {agent.displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="agent-roster-copy">
                <strong>{agent.displayName}</strong>
                <small>
                  @{agent.slug} · {agentRoleLabel(agent.role)}
                </small>
              </span>
              <AgentStatusBadge status={agent.status} />
            </li>
          ))}
        </ul>
      </section>

      <RemoteAgentDirectory workspaceId={workspaceId} channelId={channelId} />

      <section className="agent-rail-section">
        <h2>최근 작업</h2>
        <AgentTaskList
          tasks={tasks}
          activeTaskId={activeTaskId}
          isLoading={tasksLoading}
          onSelect={onSelectTask}
        />
      </section>
    </aside>
  )
}
