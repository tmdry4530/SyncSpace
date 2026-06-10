import type { Logger } from '../utils/logger.js'
import { newUuid } from '../utils/crypto.js'
import { readConfig } from '../config.js'
import { getTask, listA2aMessages, setTaskExternalId } from '../db/repositories/a2aRepository.js'
import { getRemoteAgentById, setHealthStatus, type RemoteAgentRow } from '../db/repositories/remoteAgentRepository.js'
import { enqueueJob } from '../db/repositories/jobRepository.js'
import { setTaskStatus } from '../a2a/taskService.js'
import { remoteGetTask, remoteSendMessage, remoteSetPushConfig } from '../a2a/client.js'
import { bridgeInlineMessage, bridgeRemoteTaskIntoLocal, buildRemoteTarget, statusMessage } from '../a2a/remoteBridge.js'
import { remoteCallbackToken, remoteCallbackUrl } from '../a2a/remoteCallback.js'
import { isTerminalState, type A2aTaskState, type Part } from '../a2a/types.js'

const POLL_INTERVAL_MS = 2_000
const POLL_DEADLINE_MS = 120_000
const MAX_POLL_ATTEMPTS = 90

export interface RemoteJobDeps {
  logger: Logger
}

function firstText(parts: Part[]): string {
  for (const part of parts) {
    if ('text' in part && typeof part.text === 'string') return part.text
  }
  return ''
}

async function firstUserMessageText(taskId: string): Promise<string> {
  const messages = await listA2aMessages(taskId)
  const userMessage = messages.find((m) => m.role === 'ROLE_USER')
  return userMessage ? firstText((userMessage.parts as Part[]) ?? []) : ''
}

/**
 * Best-effort: register our inbound push callback on the remote so it notifies us
 * the moment its task changes, instead of waiting for the next poll. We only try
 * when the remote advertised `pushNotifications` in its Agent Card. Polling stays
 * scheduled as the fallback regardless — push delivery is never guaranteed.
 */
async function registerRemotePush(remote: RemoteAgentRow, remoteTaskId: string, localTaskId: string, deps: RemoteJobDeps): Promise<void> {
  if (remote.capabilities_json?.['pushNotifications'] !== true) return
  const config = readConfig()
  const token = remoteCallbackToken(localTaskId, config)
  if (!token) return // no pepper configured → cannot authenticate callbacks; rely on poll
  const result = await remoteSetPushConfig(buildRemoteTarget(remote), remoteTaskId, {
    url: remoteCallbackUrl(localTaskId, config),
    token
  })
  if (!result.ok) {
    deps.logger.warn('Remote push registration failed; relying on poll fallback', { localTaskId, code: result.code })
  }
}

/** Job `remote_a2a_send`: dispatch a local proxy task to the remote agent. */
export async function processRemoteSendJob(payload: Record<string, unknown>, deps: RemoteJobDeps): Promise<void> {
  const taskId = typeof payload.taskId === 'string' ? payload.taskId : null
  if (!taskId) return
  const task = await getTask(taskId)
  if (!task || isTerminalState(task.status_state) || !task.remote_agent_id) return

  const remote = await getRemoteAgentById(task.remote_agent_id)
  if (!remote) {
    await setTaskStatus(taskId, 'TASK_STATE_FAILED', statusMessage('원격 에이전트를 찾을 수 없습니다.'))
    return
  }
  if (remote.verification_status !== 'verified' || remote.health_status === 'unhealthy') {
    await setTaskStatus(taskId, 'TASK_STATE_REJECTED', statusMessage('미검증 또는 비정상 상태의 원격 에이전트입니다.'))
    return
  }

  const text = await firstUserMessageText(taskId)
  await setTaskStatus(taskId, 'TASK_STATE_WORKING', statusMessage('원격 에이전트를 호출하는 중입니다.'))

  // Send ONLY the directed request to the external endpoint. We deliberately do
  // NOT forward the channel transcript: it contains other participants' messages
  // that must not cross the workspace boundary to a third-party server.
  const result = await remoteSendMessage(buildRemoteTarget(remote), { messageId: newUuid(), role: 'ROLE_USER', parts: [{ text }] })

  if (result.kind === 'error') {
    await setHealthStatus(remote.id, 'unhealthy').catch(() => undefined)
    deps.logger.warn('Remote A2A send failed', { taskId, code: result.error.code })
    await setTaskStatus(taskId, 'TASK_STATE_FAILED', statusMessage(`원격 호출 실패: ${result.error.code}`))
    return
  }
  await setHealthStatus(remote.id, 'healthy').catch(() => undefined)

  if (result.kind === 'message') {
    // Remote answered inline (no task) — mirror it into the task + channel and complete.
    await bridgeInlineMessage(task, remote.id, result.message.parts, deps)
    await setTaskStatus(taskId, 'TASK_STATE_COMPLETED', statusMessage('원격 에이전트가 즉시 응답했습니다.'))
    return
  }

  // kind === 'task'
  if (result.task.id) await setTaskExternalId(taskId, result.task.id)
  const state = await bridgeRemoteTaskIntoLocal(task, remote.id, result.task, deps)
  if (!isTerminalState(state) && result.task.id) {
    await registerRemotePush(remote, result.task.id, taskId, deps)
    await enqueueJob({
      queueName: 'remote',
      jobType: 'remote_a2a_poll',
      payload: { taskId, startedAt: Date.now(), attempt: 1 },
      runAfter: new Date(Date.now() + POLL_INTERVAL_MS)
    })
  }
}

/** Job `remote_a2a_poll`: poll the remote task until terminal, deadline, or max attempts. Never throws. */
export async function processRemotePollJob(payload: Record<string, unknown>, deps: RemoteJobDeps): Promise<void> {
  const taskId = typeof payload.taskId === 'string' ? payload.taskId : null
  const startedAt = typeof payload.startedAt === 'number' ? payload.startedAt : null
  const attempt = typeof payload.attempt === 'number' ? payload.attempt : 1
  if (!taskId || startedAt === null) return

  const task = await getTask(taskId)
  if (!task || isTerminalState(task.status_state) || !task.remote_agent_id || !task.external_task_id) return
  const remote = await getRemoteAgentById(task.remote_agent_id)
  if (!remote) return

  let state: A2aTaskState | null = null
  try {
    const remoteTask = await remoteGetTask(buildRemoteTarget(remote), task.external_task_id)
    await setHealthStatus(remote.id, 'healthy').catch(() => undefined)
    state = await bridgeRemoteTaskIntoLocal(task, remote.id, remoteTask, deps)
  } catch (error) {
    await setHealthStatus(remote.id, 'unhealthy').catch(() => undefined)
    deps.logger.warn('Remote A2A poll failed', { taskId, attempt, error: error instanceof Error ? error.message : String(error) })
  }

  if (state && isTerminalState(state)) return
  if (attempt >= MAX_POLL_ATTEMPTS || Date.now() - startedAt > POLL_DEADLINE_MS) {
    await setTaskStatus(taskId, 'TASK_STATE_FAILED', statusMessage('원격 작업이 시간 내에 완료되지 않았습니다.'))
    return
  }
  await enqueueJob({
    queueName: 'remote',
    jobType: 'remote_a2a_poll',
    payload: { taskId, startedAt, attempt: attempt + 1 },
    runAfter: new Date(Date.now() + POLL_INTERVAL_MS)
  })
}
