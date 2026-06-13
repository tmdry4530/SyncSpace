import type { Logger } from '../utils/logger.js'
import { newUuid } from '../utils/crypto.js'
import { getTask, listA2aMessages } from '../db/repositories/a2aRepository.js'
import { getAgentById, updateAgentStatus } from '../db/repositories/agentRepository.js'
import { persistMessage } from '../db/repositories/messageRepository.js'
import { touchDocument } from '../db/repositories/documentRepository.js'
import { addAgentMessage, addTaskArtifact, setTaskStatus } from '../a2a/taskService.js'
import { isTerminalState, type A2aMessage, type A2aTaskState, type Part } from '../a2a/types.js'
import { getAgentRuntime } from '../agents/registry.js'
import type { AgentEmitter, AgentRunContext } from '../agents/runtime.js'
import { dispatchAgentMentions, readHops } from '../agents/mentionDispatcher.js'
import { buildChannelTranscript } from '../agents/conversation.js'
import { enqueuePushForTask } from './pushNotificationWorker.js'
import { emitAgentStarted, emitAgentCompleted, emitAgentFailed, emitReviewComment } from '../agents/collabEvents.js'

const AGENT_TASK_TIMEOUT_MS = 60_000

function statusMessage(text: string): A2aMessage {
  return { messageId: newUuid(), role: 'ROLE_AGENT', parts: [{ text }] }
}

function firstText(parts: Part[]): string {
  for (const part of parts) {
    if ('text' in part && typeof part.text === 'string') return part.text
  }
  return ''
}

export interface AgentJobDeps {
  logger: Logger
}

/** Process a single `agent_task` job: drive the task through its lifecycle. */
export async function processAgentTaskJob(payload: Record<string, unknown>, deps: AgentJobDeps): Promise<void> {
  const taskId = typeof payload.taskId === 'string' ? payload.taskId : null
  if (!taskId) return

  const task = await getTask(taskId)
  if (!task || isTerminalState(task.status_state)) return
  if (!task.agent_id) return // remote-agent tasks are driven by the remote worker, not this one

  const agent = await getAgentById(task.agent_id)
  if (!agent) {
    await setTaskStatus(taskId, 'TASK_STATE_FAILED', statusMessage('에이전트를 찾을 수 없습니다.'))
    return
  }

  // Reconstruct the originating user message (text + collaboration hop count).
  const { text: userText, hops } = await originatingUserMessage(taskId)
  // Recent channel chat gives the agent conversational context for collaboration.
  const conversationText = task.channel_id
    ? await buildChannelTranscript(task.channel_id, 6_000, task.workspace_id).catch(() => null)
    : null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), AGENT_TASK_TIMEOUT_MS)

  // Capture the last reviewer message text for review_comment event emission.
  let lastReviewerMessageText = ''

  const emit: AgentEmitter = {
    status: async (state: A2aTaskState, summaryText?: string) => {
      await setTaskStatus(taskId, state, summaryText ? statusMessage(summaryText) : null)
      await enqueuePushForTask(taskId).catch(() => undefined)
    },
    artifact: async (input) => {
      await addTaskArtifact(taskId, task.context_id, {
        artifactId: input.artifactId,
        ...(input.name ? { name: input.name } : {}),
        ...(input.description ? { description: input.description } : {}),
        parts: input.parts
      })
      await enqueuePushForTask(taskId).catch(() => undefined)
    },
    message: async (parts: Part[]) => {
      const messageId = newUuid()
      await addAgentMessage(taskId, task.context_id, { messageId, parts, participantId: agent.participant_id })
      // Mirror a short summary into the channel chat as the agent participant.
      if (task.channel_id) {
        const content = firstText(parts).slice(0, 4000) || '(agent message)'
        await persistMessage({
          channelId: task.channel_id,
          content,
          authorParticipantId: agent.participant_id,
          authorType: 'agent',
          agentId: agent.id,
          a2aMessageId: null,
          clientId: `a2a:${messageId}`,
          metadata: { taskId, source: 'agent' }
        }).catch((error) => deps.logger.warn('Failed to mirror agent chat message', { taskId, error: String(error) }))
        // Agent-to-agent collaboration: @mentions in agent output activate teammates.
        await dispatchAgentMentions({
          workspaceId: task.workspace_id,
          channelId: task.channel_id,
          content,
          authorParticipantId: agent.participant_id,
          authorInternalAgentId: agent.id,
          hops,
          // Pass the current task's context so all collaboration tasks in the
          // same chain share one a2a context (= one mission in the Mission View).
          originContextId: task.context_id,
          logger: deps.logger
        })
      }
      // Capture reviewer message text for review_comment event (emitted after run).
      if (agent.role === 'reviewer') {
        lastReviewerMessageText = firstText(parts)
      }
    },
    appendDocument: async (markdown: string) => {
      // Safe document reflection: record the section as an artifact-backed event
      // and bump the document timestamp without mutating the live prosemirror Yjs
      // tree (avoids corruption; live insertion is a future enhancement).
      if (!task.document_id) return
      await addTaskArtifact(taskId, task.context_id, {
        artifactId: `document-append-${newUuid().slice(0, 8)}`,
        name: 'Document Append',
        description: 'Markdown reflected into the bound document',
        parts: [{ text: markdown }],
        metadata: { documentId: task.document_id, kind: 'document_patch' }
      })
      await touchDocument(task.document_id).catch(() => undefined)
    }
  }

  const ctx: AgentRunContext = {
    taskId,
    contextId: task.context_id,
    workspaceId: task.workspace_id,
    channelId: task.channel_id,
    documentId: task.document_id,
    agentRole: agent.role,
    userMessageText: userText,
    conversationText,
    emit,
    signal: controller.signal
  }

  try {
    await updateAgentStatus(agent.id, 'running')
    // Collaboration-progress engineering events: the emitters log and
    // swallow all their own errors, so no catch is needed at call sites.
    await emitAgentStarted(taskId, task.context_id, agent.id, agent.role, deps.logger)

    await getAgentRuntime(agent.role).run(ctx)

    // The runtime can end the task FAILED/CANCELED without throwing (provider
    // errors and timeouts are absorbed inside run; cancellation can land
    // mid-run), so the engineering events must follow the FINAL task state —
    // never record done/review events for a task that did not complete.
    const finalTask = await getTask(taskId)
    const endedUnsuccessfully =
      finalTask !== null &&
      isTerminalState(finalTask.status_state) &&
      finalTask.status_state !== 'TASK_STATE_COMPLETED'

    if (finalTask && !isTerminalState(finalTask.status_state)) {
      await setTaskStatus(taskId, 'TASK_STATE_COMPLETED', statusMessage('완료되었습니다.'))
      await enqueuePushForTask(taskId).catch(() => undefined)
    }

    if (endedUnsuccessfully) {
      await emitAgentFailed(taskId, task.context_id, agent.id, agent.role, deps.logger)
      await updateAgentStatus(agent.id, finalTask.status_state === 'TASK_STATE_FAILED' ? 'failed' : 'idle')
    } else {
      // Reviewer: emit review_comment with the actual reviewer message text.
      if (agent.role === 'reviewer') {
        await emitReviewComment(taskId, task.context_id, agent.id, lastReviewerMessageText, deps.logger)
      }
      await emitAgentCompleted(taskId, task.context_id, agent.id, agent.role, deps.logger)
      await updateAgentStatus(agent.id, 'idle')
    }
  } catch (error) {
    deps.logger.error('Agent task failed', { taskId, error: error instanceof Error ? error.message : String(error) })
    await setTaskStatus(taskId, 'TASK_STATE_FAILED', statusMessage('처리 중 오류가 발생했습니다.'))
    await enqueuePushForTask(taskId).catch(() => undefined)
    await emitAgentFailed(taskId, task.context_id, agent.id, agent.role, deps.logger)
    await updateAgentStatus(agent.id, 'failed').catch(() => undefined)
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function originatingUserMessage(taskId: string): Promise<{ text: string; hops: number }> {
  const messages = await listA2aMessages(taskId)
  const userMessage = messages.find((message) => message.role === 'ROLE_USER')
  if (!userMessage) return { text: '', hops: 0 }
  const parts = (userMessage.parts as Part[]) ?? []
  return { text: firstText(parts), hops: readHops(userMessage.metadata) }
}
