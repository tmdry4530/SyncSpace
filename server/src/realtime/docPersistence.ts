import { dirname, join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as Y from 'yjs'
import type { ServerConfig } from '../config.js'
import type { Logger } from '../utils/logger.js'
import { isDocRoomName, parseDocRoomName } from './docRoom.js'
import { readSnapshot as readPgSnapshot, upsertSnapshot } from '../db/repositories/yjsSnapshotRepository.js'

export interface DocPersistenceHooks {
  bind(roomName: string, ydoc: Y.Doc): Promise<void>
  flush(roomName: string, ydoc: Y.Doc): Promise<void>
}

/** Storage backend for Yjs document snapshots. */
export interface DocStorageBackend {
  read(roomName: string): Promise<Uint8Array | null>
  write(roomName: string, update: Uint8Array): Promise<void>
}

export interface DocPersistenceOptions {
  debounceMs?: number
  backend?: DocStorageBackend
}

export class FileDocStorage implements DocStorageBackend {
  constructor(
    private readonly storageDir: string,
    private readonly logger: Logger
  ) {}

  async read(roomName: string): Promise<Uint8Array | null> {
    const filePath = this.path(roomName)
    if (!existsSync(filePath)) return null
    try {
      return new Uint8Array(readFileSync(filePath))
    } catch (error) {
      this.logger.warn('Failed to read document Yjs snapshot', { roomName, error: errMessage(error) })
      return null
    }
  }

  async write(roomName: string, update: Uint8Array): Promise<void> {
    const filePath = this.path(roomName)
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, update)
  }

  private path(roomName: string): string {
    return join(this.storageDir, `${Buffer.from(roomName).toString('base64url')}.bin`)
  }
}

export class PostgresDocStorage implements DocStorageBackend {
  constructor(private readonly logger: Logger) {}

  async read(roomName: string): Promise<Uint8Array | null> {
    try {
      return await readPgSnapshot(roomName)
    } catch (error) {
      this.logger.warn('Failed to read document snapshot from Postgres', { roomName, error: errMessage(error) })
      return null
    }
  }

  async write(roomName: string, update: Uint8Array): Promise<void> {
    const parts = parseDocRoomName(roomName)
    if (!parts) return
    await upsertSnapshot({
      roomName,
      workspaceId: parts.workspaceId,
      documentId: parts.documentId,
      stateUpdate: update
    })
  }
}

export function createDocStorageBackend(config: ServerConfig, logger: Logger): DocStorageBackend {
  if (config.docPersistenceMode === 'postgres' && config.databaseUrl) {
    return new PostgresDocStorage(logger)
  }
  const storageDir = process.env.SYNCSPACE_DOC_PERSISTENCE_DIR ?? '.syncspace-data/ydocs'
  return new FileDocStorage(storageDir, logger)
}

export function createDocRoomPersistenceHooks(logger: Logger, options: DocPersistenceOptions = {}): DocPersistenceHooks {
  const debounceMs = options.debounceMs ?? 250
  const backend = options.backend ?? new FileDocStorage(process.env.SYNCSPACE_DOC_PERSISTENCE_DIR ?? '.syncspace-data/ydocs', logger)
  const timers = new Map<string, NodeJS.Timeout>()

  async function flush(roomName: string, ydoc: Y.Doc): Promise<void> {
    if (!isDocRoomName(roomName)) return
    try {
      const update = Y.encodeStateAsUpdate(ydoc)
      await backend.write(roomName, update)
    } catch (error) {
      logger.warn('Failed to persist document Yjs state', { roomName, error: errMessage(error) })
    }
  }

  async function bind(roomName: string, ydoc: Y.Doc): Promise<void> {
    if (!isDocRoomName(roomName)) return

    const stored = await backend.read(roomName)
    if (stored) {
      try {
        Y.applyUpdate(ydoc, stored)
      } catch (error) {
        logger.warn('Failed to restore document Yjs state', { roomName, error: errMessage(error) })
      }
    }

    const scheduleFlush = (): void => {
      const existing = timers.get(roomName)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => {
        timers.delete(roomName)
        void flush(roomName, ydoc)
      }, debounceMs)
      timers.set(roomName, timer)
    }

    ydoc.on('update', scheduleFlush)
    await flush(roomName, ydoc)
  }

  return { bind, flush }
}

function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
