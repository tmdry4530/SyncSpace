import { createHash } from 'node:crypto'
import type { Logger } from '../utils/logger.js'
import { getTask, appendEvent } from '../db/repositories/a2aRepository.js'
import { getPushConfig, listPushConfigs } from '../db/repositories/a2aPushRepository.js'
import { enqueueJob } from '../db/repositories/jobRepository.js'
import { assembleTask } from '../a2a/taskService.js'
import { assertSafeWebhookUrl, deliverWebhook } from '../a2a/push.js'

/** Enqueue a push-delivery job per active config for a task's latest state. */
export async function enqueuePushForTask(taskId: string): Promise<void> {
  const configs = await listPushConfigs(taskId)
  for (const config of configs) {
    await enqueueJob({ queueName: 'push', jobType: 'push_delivery', payload: { taskId, configId: config.config_id } })
  }
}

export interface PushJobDeps {
  logger: Logger
}

/**
 * Deliver the current task snapshot to a webhook. Throws on retryable failures
 * (5xx / network) so the job runner reschedules with backoff; 4xx is terminal.
 */
export async function processPushJob(payload: Record<string, unknown>, deps: PushJobDeps): Promise<void> {
  const taskId = typeof payload.taskId === 'string' ? payload.taskId : null
  const configId = typeof payload.configId === 'string' ? payload.configId : null
  if (!taskId || !configId) return

  const config = await getPushConfig(taskId, configId)
  if (!config) return

  const taskRow = await getTask(taskId)
  if (!taskRow) return
  const snapshot = await assembleTask(taskId)
  if (!snapshot) return

  // Re-validate the destination at delivery time (DNS rebinding defense).
  await assertSafeWebhookUrl(config.url)

  const idempotencyKey = createHash('sha256')
    .update(`${taskId}:${configId}:${taskRow.status_state}:${taskRow.status_updated_at}`)
    .digest('hex')

  const result = await deliverWebhook(config.url, { task: snapshot }, { idempotencyKey })

  await appendEvent({
    taskId,
    contextId: taskRow.context_id,
    eventType: 'push_delivery',
    payload: { configId, ok: result.ok, status: result.status, idempotencyKey, ...(result.error ? { error: result.error } : {}) },
    visibleToUser: false
  })

  if (!result.ok && (result.status === 0 || result.status >= 500)) {
    throw new Error(`Webhook delivery failed with status ${result.status}${result.error ? `: ${result.error}` : ''}`)
  }
  if (!result.ok) {
    deps.logger.warn('Webhook delivery returned a non-retryable error', { taskId, configId, status: result.status })
  }
}
