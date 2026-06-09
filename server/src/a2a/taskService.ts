import { withTransaction } from '../db/query.js'
import {
  appendEvent,
  createContext,
  createTask,
  findA2aMessage,
  getContext,
  getTask,
  insertA2aMessage,
  listA2aMessages,
  listArtifacts,
  updateTaskStatus,
  upsertArtifact,
  type A2aTaskRow
} from '../db/repositories/a2aRepository.js'
import { enqueueJob } from '../db/repositories/jobRepository.js'
import {
  buildArtifactUpdateEvent,
  buildStatusUpdateEvent,
  mapArtifactRowToA2aArtifact,
  mapMessageRowToA2aMessage,
  mapTaskRowToA2aTask
} from './mapper.js'
import { isTerminalState, type A2aMessage, type A2aTaskState, type Part, type Task } from './types.js'

export interface CreateTaskInput {
  workspaceId: string
  agentId: string
  contextId?: string | null
  channelId?: string | null
  documentId?: string | null
  createdByParticipantId?: string | null
  title?: string | null
  acceptedOutputModes?: string[]
  message: { messageId: string; parts: Part[]; role?: 'ROLE_USER' | 'ROLE_AGENT'; metadata?: Record<string, unknown> }
  enqueue?: boolean
}

export interface CreateTaskResult {
  task: Task
  created: boolean
}

/** Assemble a full A2A Task (status + artifacts + history) from the database. */
export async function assembleTask(taskId: string): Promise<Task | null> {
  const row = await getTask(taskId)
  if (!row) return null
  const [artifacts, history] = await Promise.all([listArtifacts(taskId), listA2aMessages(taskId)])
  return mapTaskRowToA2aTask(row, { artifacts, history })
}

export async function createTaskFromMessage(input: CreateTaskInput): Promise<CreateTaskResult> {
  // messageId idempotency within an existing context.
  if (input.contextId) {
    const existing = await findA2aMessage(input.contextId, input.message.messageId)
    if (existing?.task_id) {
      const task = await assembleTask(existing.task_id)
      if (task) return { task, created: false }
    }
  }

  const taskRow = await withTransaction(async (client) => {
    const context = input.contextId
      ? await getContext(input.contextId, client)
      : await createContext(
          {
            workspaceId: input.workspaceId,
            channelId: input.channelId ?? null,
            documentId: input.documentId ?? null,
            createdByParticipantId: input.createdByParticipantId ?? null
          },
          client
        )
    if (!context) throw new Error('A2A context not found')
    // Never bind a task to a context from a different workspace.
    if (context.workspace_id !== input.workspaceId) throw new Error('A2A context not found')

    const task = await createTask(
      {
        contextId: context.id,
        workspaceId: input.workspaceId,
        channelId: input.channelId ?? null,
        documentId: input.documentId ?? null,
        agentId: input.agentId,
        title: input.title ?? null,
        createdByParticipantId: input.createdByParticipantId ?? null,
        ...(input.acceptedOutputModes ? { acceptedOutputModes: input.acceptedOutputModes } : {})
      },
      client
    )

    await insertA2aMessage(
      {
        messageId: input.message.messageId,
        taskId: task.id,
        contextId: context.id,
        role: input.message.role ?? 'ROLE_USER',
        participantId: input.createdByParticipantId ?? null,
        parts: input.message.parts,
        ...(input.message.metadata ? { metadata: input.message.metadata } : {})
      },
      client
    )

    const wireTask = mapTaskRowToA2aTask(task)
    await appendEvent(
      { taskId: task.id, contextId: context.id, eventType: 'task_snapshot', payload: wireTask as unknown as Record<string, unknown> },
      client
    )

    if (input.enqueue !== false) {
      await enqueueJob({ queueName: 'agent', jobType: 'agent_task', payload: { taskId: task.id } }, client)
    }
    return task
  })

  const task = await assembleTask(taskRow.id)
  if (!task) throw new Error('Failed to assemble created task')
  return { task, created: true }
}

/** Update task status and emit an ordered status_update event. */
export async function setTaskStatus(
  taskId: string,
  state: A2aTaskState,
  statusMessage?: A2aMessage | null
): Promise<A2aTaskRow | null> {
  return withTransaction(async (client) => {
    const row = await updateTaskStatus({ taskId, state, statusMessage: (statusMessage as unknown as Record<string, unknown>) ?? null }, client)
    if (!row) return null
    const event = buildStatusUpdateEvent(row, isTerminalState(state))
    await appendEvent(
      { taskId, contextId: row.context_id, eventType: 'status_update', payload: event as unknown as Record<string, unknown> },
      client
    )
    return row
  })
}

/** Upsert an artifact and emit an artifact_update event. */
export async function addTaskArtifact(
  taskId: string,
  contextId: string,
  artifact: { artifactId: string; name?: string | null; description?: string | null; parts: Part[]; metadata?: Record<string, unknown> }
): Promise<void> {
  await withTransaction(async (client) => {
    const row = await upsertArtifact(
      {
        taskId,
        artifactId: artifact.artifactId,
        name: artifact.name ?? null,
        description: artifact.description ?? null,
        parts: artifact.parts,
        ...(artifact.metadata ? { metadata: artifact.metadata } : {})
      },
      client
    )
    const event = buildArtifactUpdateEvent(taskId, contextId, mapArtifactRowToA2aArtifact(row))
    await appendEvent(
      { taskId, contextId, eventType: 'artifact_update', payload: event as unknown as Record<string, unknown> },
      client
    )
  })
}

/** Append an agent message and emit a message event (chat summary, clarification). */
export async function addAgentMessage(
  taskId: string,
  contextId: string,
  message: { messageId: string; parts: Part[]; participantId?: string | null; metadata?: Record<string, unknown> }
): Promise<void> {
  await withTransaction(async (client) => {
    const row = await insertA2aMessage(
      {
        messageId: message.messageId,
        taskId,
        contextId,
        role: 'ROLE_AGENT',
        participantId: message.participantId ?? null,
        parts: message.parts,
        ...(message.metadata ? { metadata: message.metadata } : {})
      },
      client
    )
    await appendEvent(
      {
        taskId,
        contextId,
        eventType: 'message',
        payload: mapMessageRowToA2aMessage(row) as unknown as Record<string, unknown>
      },
      client
    )
  })
}

/** Append a user message to an existing task and re-enqueue processing. */
export async function sendMessageToExistingTask(
  taskRow: A2aTaskRow,
  message: { messageId: string; parts: Part[]; participantId?: string | null; metadata?: Record<string, unknown> }
): Promise<Task | null> {
  await withTransaction(async (client) => {
    const inserted = await insertA2aMessage(
      {
        messageId: message.messageId,
        taskId: taskRow.id,
        contextId: taskRow.context_id,
        role: 'ROLE_USER',
        participantId: message.participantId ?? null,
        parts: message.parts,
        ...(message.metadata ? { metadata: message.metadata } : {})
      },
      client
    )
    await appendEvent(
      {
        taskId: taskRow.id,
        contextId: taskRow.context_id,
        eventType: 'message',
        payload: mapMessageRowToA2aMessage(inserted) as unknown as Record<string, unknown>
      },
      client
    )
    await enqueueJob({ queueName: 'agent', jobType: 'agent_task', payload: { taskId: taskRow.id } }, client)
  })
  return assembleTask(taskRow.id)
}

/** Cancel a task idempotently; returns the (possibly already-terminal) task. */
export async function cancelTask(taskId: string): Promise<Task | null> {
  const current = await getTask(taskId)
  if (!current) return null
  if (isTerminalState(current.status_state)) {
    return assembleTask(taskId)
  }
  await setTaskStatus(taskId, 'TASK_STATE_CANCELED')
  return assembleTask(taskId)
}
