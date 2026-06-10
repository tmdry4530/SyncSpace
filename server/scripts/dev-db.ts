/**
 * dev-db.ts — boot a persistent embedded Postgres cluster for local development.
 *
 * Unlike the throwaway test cluster (test/helpers/embeddedPostgres.ts), this one
 * uses `persistent: true` and a fixed data directory at the repo root so data
 * survives restarts. It stays alive until SIGINT/SIGTERM; the bundled Postgres
 * binary is a child of this process and is stopped on shutdown.
 *
 * Readiness is signalled by writing `.syncspace-data/.dev-db-ready` after the
 * database is created, so an orchestrator can wait for that file (the TCP port
 * opens slightly before the application database exists).
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const dataRoot = resolve(repoRoot, '.syncspace-data')
const dataDir = join(dataRoot, 'pgdata')
const readyMarker = join(dataRoot, '.dev-db-ready')

const port = Number(process.env.DEV_DB_PORT ?? 5433)
const dbName = process.env.DEV_DB_NAME ?? 'syncspace'

mkdirSync(dataRoot, { recursive: true })
rmSync(readyMarker, { force: true })

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
  authMethod: 'scram-sha-256',
  onLog: () => undefined,
  onError: (error: unknown) => console.error('[dev-db] postgres error:', error)
})

const isInitialised = existsSync(join(dataDir, 'PG_VERSION'))
if (!isInitialised) {
  console.log(`[dev-db] initialising cluster at ${dataDir}`)
  await pg.initialise()
}

await pg.start()
console.log(`[dev-db] postgres listening on 127.0.0.1:${port}`)

try {
  await pg.createDatabase(dbName)
  console.log(`[dev-db] created database "${dbName}"`)
} catch {
  console.log(`[dev-db] database "${dbName}" already exists`)
}

writeFileSync(readyMarker, `${new Date().toISOString()}\n`)
console.log(`[dev-db] ready — postgresql://postgres:postgres@127.0.0.1:${port}/${dbName}`)

let stopping = false
const shutdown = async (signal: string): Promise<void> => {
  if (stopping) return
  stopping = true
  console.log(`[dev-db] ${signal} received, stopping postgres...`)
  rmSync(readyMarker, { force: true })
  await pg.stop().catch(() => undefined)
  process.exit(0)
}
process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

// Keep the process alive so the embedded Postgres child keeps running.
setInterval(() => undefined, 1 << 30)
