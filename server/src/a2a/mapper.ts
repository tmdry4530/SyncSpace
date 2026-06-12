import type {
  A2aArtifactRow,
  A2aContextRow,
  A2aMessageRow,
  A2aTaskEventRow,
  A2aTaskRow
} from '../db/repositories/a2aRepository.js'
import type {
  A2aMessage,
  Artifact,
  Part,
  StreamResponse,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatus,
  TaskStatusUpdateEvent
} from './types.js'
import { isEngineeringEventType } from './engineeringEvents.js'
import type { EngineeringEvent } from './engineeringEvents.js'

export function mapMessageRowToA2aMessage(row: A2aMessageRow): A2aMessage {
  return {
    messageId: row.message_id,
    role: row.role,
    parts: (row.parts as Part[]) ?? [],
    ...(row.task_id ? { taskId: row.task_id } : {}),
    contextId: row.context_id,
    ...(row.extensions?.length ? { extensions: row.extensions } : {}),
    ...(row.metadata && Object.keys(row.metadata).length ? { metadata: row.metadata } : {})
  }
}

export function mapArtifactRowToA2aArtifact(row: A2aArtifactRow): Artifact {
  return {
    artifactId: row.artifact_id,
    ...(row.name ? { name: row.name } : {}),
    ...(row.description ? { description: row.description } : {}),
    parts: (row.parts as Part[]) ?? [],
    ...(row.extensions?.length ? { extensions: row.extensions } : {}),
    ...(row.metadata && Object.keys(row.metadata).length ? { metadata: row.metadata } : {})
  }
}

export function buildTaskStatus(row: A2aTaskRow): TaskStatus {
  const message = row.status_message as A2aMessage | null
  return {
    state: row.status_state,
    ...(message ? { message } : {}),
    timestamp: row.status_updated_at
  }
}

export function mapTaskRowToA2aTask(
  row: A2aTaskRow,
  options: { artifacts?: A2aArtifactRow[]; history?: A2aMessageRow[] } = {}
): Task {
  return {
    id: row.id,
    contextId: row.context_id,
    status: buildTaskStatus(row),
    ...(options.artifacts ? { artifacts: options.artifacts.map(mapArtifactRowToA2aArtifact) } : {}),
    ...(options.history ? { history: options.history.map(mapMessageRowToA2aMessage) } : {}),
    ...(row.metadata && Object.keys(row.metadata).length ? { metadata: row.metadata } : {})
  }
}

export function buildStatusUpdateEvent(row: A2aTaskRow, final: boolean): TaskStatusUpdateEvent {
  return {
    taskId: row.id,
    contextId: row.context_id,
    status: buildTaskStatus(row),
    final
  }
}

export function buildArtifactUpdateEvent(taskId: string, contextId: string, artifact: Artifact): TaskArtifactUpdateEvent {
  return { taskId, contextId, artifact, append: false, lastChunk: true }
}

/** Map a persisted task event to the SSE StreamResponse it represents, or null if not client-visible. */
export function mapEventRowToStreamResponse(row: A2aTaskEventRow): StreamResponse | null {
  if (!row.visible_to_user) return null
  switch (row.event_type) {
    case 'task_snapshot':
      return { task: row.payload as unknown as Task }
    case 'message':
      return { message: row.payload as unknown as A2aMessage }
    case 'status_update':
      return { statusUpdate: row.payload as unknown as TaskStatusUpdateEvent }
    case 'artifact_update':
      return { artifactUpdate: row.payload as unknown as TaskArtifactUpdateEvent }
    default:
      if (isEngineeringEventType(row.event_type)) {
        return { engineeringEvent: row.payload as unknown as EngineeringEvent }
      }
      return null
  }
}

export { type A2aContextRow }
