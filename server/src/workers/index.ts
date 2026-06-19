import { pathToFileURL } from 'node:url'
import { readConfig } from '../config.js'
import { createLogger } from '../utils/logger.js'
import { closePool } from '../db/pool.js'
import { startJobRunner, type JobRunnerHandle, type QueueSpec } from './jobRunner.js'
import { processAgentTaskJob } from './agentTaskWorker.js'
import { processPushJob } from './pushNotificationWorker.js'

export function buildWorkerQueues(): QueueSpec[] {
  const queues: QueueSpec[] = []
  if (process.env.AGENT_WORKER_ENABLED !== 'false') {
    queues.push({ name: 'agent', handlers: { agent_task: (payload, deps) => processAgentTaskJob(payload, deps) } })
  }
  if (process.env.PUSH_WORKER_ENABLED !== 'false') {
    queues.push({ name: 'push', handlers: { push_delivery: (payload, deps) => processPushJob(payload, deps) } })
  }
  return queues
}

export function startWorker(): JobRunnerHandle {
  const config = readConfig()
  const logger = createLogger(config.logLevel)
  const workerId = process.env.WORKER_ID ?? `agent-worker-${process.pid}`
  const runner = startJobRunner({ logger, workerId, queues: buildWorkerQueues() })
  runner.start()
  logger.info('SyncSpace agent worker started', { workerId })
  return runner
}

function isMainModule(): boolean {
  const entry = process.argv[1]
  return Boolean(entry && import.meta.url === pathToFileURL(entry).href)
}

if (isMainModule()) {
  const runner = startWorker()
  const shutdown = async (): Promise<void> => {
    await runner.stop()
    await closePool().catch(() => undefined)
    process.exit(0)
  }
  process.once('SIGINT', () => void shutdown())
  process.once('SIGTERM', () => void shutdown())
}
