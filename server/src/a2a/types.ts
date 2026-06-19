/**
 * A2A wire object types (HTTP+JSON binding). These mirror the A2A protocol
 * surface SyncSpace exposes; DB rows are mapped to/from these in mapper.ts.
 */

export type A2aTaskState =
  | 'TASK_STATE_UNSPECIFIED'
  | 'TASK_STATE_SUBMITTED'
  | 'TASK_STATE_WORKING'
  | 'TASK_STATE_INPUT_REQUIRED'
  | 'TASK_STATE_AUTH_REQUIRED'
  | 'TASK_STATE_COMPLETED'
  | 'TASK_STATE_FAILED'
  | 'TASK_STATE_CANCELED'
  | 'TASK_STATE_REJECTED'

export type A2aMessageRole = 'ROLE_USER' | 'ROLE_AGENT'

export interface TextPart {
  text: string
  metadata?: Record<string, unknown>
}

export interface DataPart {
  data: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface FilePart {
  file: {
    name?: string
    mimeType?: string
    uri?: string
    bytes?: string
  }
  metadata?: Record<string, unknown>
}

export type Part = TextPart | DataPart | FilePart

export interface A2aMessage {
  messageId: string
  role: A2aMessageRole
  parts: Part[]
  taskId?: string
  contextId?: string
  extensions?: string[]
  metadata?: Record<string, unknown>
}

export interface TaskStatus {
  state: A2aTaskState
  message?: A2aMessage
  timestamp?: string
}

export interface Artifact {
  artifactId: string
  name?: string
  description?: string
  parts: Part[]
  extensions?: string[]
  metadata?: Record<string, unknown>
}

export interface Task {
  id: string
  contextId: string
  status: TaskStatus
  artifacts?: Artifact[]
  history?: A2aMessage[]
  metadata?: Record<string, unknown>
}

export interface TaskStatusUpdateEvent {
  taskId: string
  contextId: string
  status: TaskStatus
  final: boolean
}

export interface TaskArtifactUpdateEvent {
  taskId: string
  contextId: string
  artifact: Artifact
  append?: boolean
  lastChunk?: boolean
}

/** A single SSE event payload on a stream/subscribe response. */
export type StreamResponse =
  | { task: Task }
  | { message: A2aMessage }
  | { statusUpdate: TaskStatusUpdateEvent }
  | { artifactUpdate: TaskArtifactUpdateEvent }

export interface ListTasksResponse {
  tasks: Task[]
  nextPageToken?: string
}

export const TERMINAL_STATES: ReadonlySet<A2aTaskState> = new Set([
  'TASK_STATE_COMPLETED',
  'TASK_STATE_FAILED',
  'TASK_STATE_CANCELED',
  'TASK_STATE_REJECTED'
])

export function isTerminalState(state: A2aTaskState): boolean {
  return TERMINAL_STATES.has(state)
}
