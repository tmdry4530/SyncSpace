import { createSyncSpaceServer } from './http/app.js'

const app = createSyncSpaceServer()

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  console.log(JSON.stringify({ level: 'info', message: 'Shutting down SyncSpace backend', signal }))
  await app.stop()
}

process.once('SIGINT', () => {
  void shutdown('SIGINT').finally(() => process.exit(0))
})

process.once('SIGTERM', () => {
  void shutdown('SIGTERM').finally(() => process.exit(0))
})

await app.start()
