import { useTaskDetailQuery } from '../../agents/queries/useTaskDetailQuery'
import type { TaskDetail, TaskEvent } from '../../../shared/types/contracts'
import {
  type EngineeringEvent,
  type PipelineStageEvent,
  type AgentStatusEvent,
  parseEngineeringEvent,
  isEngineeringEventKind
} from '../../../shared/types/engineeringEvents'

export interface EngineeringTaskEvent extends TaskEvent {
  engineeringEvent: EngineeringEvent
}

export interface MissionData {
  detail: TaskDetail
  /** All engineering events in seq order */
  engineeringEvents: EngineeringTaskEvent[]
  /** Latest pipeline_stage per stage name */
  pipelineStages: Map<string, PipelineStageEvent>
  /** Latest agent_status per agentId */
  agentRoster: Map<string, AgentStatusEvent>
}

function unwrapEvent(ev: TaskEvent): EngineeringEvent | null {
  if (!isEngineeringEventKind(ev.type)) return null
  const payload = ev.payload as Record<string, unknown> | null
  if (!payload) return null
  // Payload shape: { engineeringEvent: <EngineeringEvent> }
  const inner = payload['engineeringEvent'] ?? payload
  return parseEngineeringEvent(inner)
}

function deriveMissionData(detail: TaskDetail): MissionData {
  const engineeringEvents: EngineeringTaskEvent[] = []
  const pipelineStages = new Map<string, PipelineStageEvent>()
  const agentRoster = new Map<string, AgentStatusEvent>()

  for (const ev of detail.events) {
    const eng = unwrapEvent(ev)
    if (!eng) continue
    engineeringEvents.push({ ...ev, engineeringEvent: eng })

    if (eng.kind === 'pipeline_stage') {
      // Keep latest (highest seq) per stage
      pipelineStages.set(eng.stage, eng)
    }
    if (eng.kind === 'agent_status') {
      agentRoster.set(eng.agentId, eng)
    }
  }

  return { detail, engineeringEvents, pipelineStages, agentRoster }
}

export function useMissionQuery(taskId: string | null | undefined) {
  const query = useTaskDetailQuery(taskId)
  const missionData = query.data ? deriveMissionData(query.data) : null
  return { ...query, missionData }
}
