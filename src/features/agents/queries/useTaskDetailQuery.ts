import { useQuery } from '@tanstack/react-query'
import { getBackendJson } from '../../../shared/api/backendClient'
import type { A2aTaskState, TaskDetail } from '../../../shared/types/contracts'
import { realtimePolling } from '../../realtime/queryPolling'
import { agentKeys } from './useAgentsQuery'

const TERMINAL_STATES: ReadonlySet<A2aTaskState> = new Set<A2aTaskState>([
  'TASK_STATE_COMPLETED',
  'TASK_STATE_FAILED',
  'TASK_STATE_CANCELED',
  'TASK_STATE_REJECTED'
])

export function useTaskDetailQuery(taskId: string | null | undefined) {
  return useQuery({
    queryKey: taskId ? agentKeys.task(taskId) : ['agents', 'task', 'missing'],
    queryFn: () => fetchTaskDetail(taskId!),
    enabled: Boolean(taskId),
    staleTime: 1_000,
    refetchInterval: (query) => {
      const state = query.state.data?.task.status.state
      if (state && TERMINAL_STATES.has(state)) return false
      return realtimePolling.refetchInterval
    }
  })
}

export async function fetchTaskDetail(taskId: string): Promise<TaskDetail> {
  return getBackendJson<TaskDetail>(`/api/tasks/${encodeURIComponent(taskId)}`)
}
