import type { Logger } from '../utils/logger.js'
import { claimJob, completeJob, failJob, rescheduleJob } from '../db/repositories/jobRepository.js'

export type JobHandler = (payload: Record<string, unknown>, deps: { logger: Logger }) => Promise<void>

export interface QueueSpec {
  name: string
  handlers: Record<string, JobHandler>
}

export interface JobRunnerOptions {
  logger: Logger
  workerId: string
  queues: QueueSpec[]
  pollIntervalMs?: number
  backoffBaseMs?: number
}

export interface JobRunnerHandle {
  start(): void
  stop(): Promise<void>
  /** Drain all currently-ready jobs once (used by tests). */
  drainOnce(): Promise<number>
}

export function startJobRunner(options: JobRunnerOptions): JobRunnerHandle {
  const pollIntervalMs = options.pollIntervalMs ?? 250
  const backoffBaseMs = options.backoffBaseMs ?? 1_000
  let stopped = false
  let timer: NodeJS.Timeout | null = null
  let running = false

  async function processOne(queue: QueueSpec): Promise<boolean> {
    const job = await claimJob(queue.name, options.workerId).catch((error) => {
      options.logger.warn('Failed to claim job', { queue: queue.name, error: String(error) })
      return null
    })
    if (!job) return false

    const handler = queue.handlers[job.job_type]
    try {
      if (!handler) throw new Error(`No handler registered for job type ${job.job_type}`)
      await handler(job.payload, { logger: options.logger })
      await completeJob(job.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (job.attempts < job.max_attempts) {
        const backoff = backoffBaseMs * 2 ** Math.max(0, job.attempts - 1)
        await rescheduleJob(job.id, message, backoff).catch(() => undefined)
      } else {
        await failJob(job.id, message).catch(() => undefined)
        options.logger.error('Job exhausted retries', { jobId: job.id, jobType: job.job_type, error: message })
      }
    }
    return true
  }

  async function tick(): Promise<void> {
    if (stopped || running) return
    running = true
    let processedAny = false
    try {
      for (const queue of options.queues) {
        // Drain a queue while jobs are immediately available.
        // eslint-disable-next-line no-await-in-loop
        while (!stopped && (await processOne(queue))) {
          processedAny = true
        }
      }
    } finally {
      running = false
      if (!stopped) schedule(processedAny ? 0 : pollIntervalMs)
    }
  }

  function schedule(delay: number): void {
    timer = setTimeout(() => void tick(), delay)
  }

  return {
    start: () => schedule(0),
    stop: async () => {
      stopped = true
      if (timer) clearTimeout(timer)
      // Allow an in-flight tick to settle.
      while (running) await new Promise((resolve) => setTimeout(resolve, 20))
    },
    drainOnce: async () => {
      let count = 0
      for (const queue of options.queues) {
        while (await processOne(queue)) count += 1
      }
      return count
    }
  }
}
