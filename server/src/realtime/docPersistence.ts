import { dirname, join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as Y from 'yjs'
import type { Logger } from '../utils/logger.js'
import { isDocRoomName } from './docRoom.js'

export interface DocPersistenceHooks {
  bind(roomName: string, ydoc: Y.Doc): void
  flush(roomName: string, ydoc: Y.Doc): Promise<void>
}

export interface DocPersistenceOptions {
  debounceMs?: number
  storageDir?: string | null
}

export function createDocRoomPersistenceHooks(logger: Logger, options: DocPersistenceOptions = {}): DocPersistenceHooks {
  const debounceMs = options.debounceMs ?? 250
  const storageDir = options.storageDir ?? process.env.SYNCSPACE_DOC_PERSISTENCE_DIR ?? '.syncspace-data/ydocs'
  const snapshots = new Map<string, Uint8Array>()
  const timers = new Map<string, NodeJS.Timeout>()

  async function flush(roomName: string, ydoc: Y.Doc): Promise<void> {
    if (!isDocRoomName(roomName)) return

    try {
      const update = Y.encodeStateAsUpdate(ydoc)
      snapshots.set(roomName, update)
      if (storageDir) {
        const filePath = snapshotPath(storageDir, roomName)
        mkdirSync(dirname(filePath), { recursive: true })
        writeFileSync(filePath, update)
      }
    } catch (error) {
      logger.warn('Failed to persist document Yjs state', {
        roomName,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  function bind(roomName: string, ydoc: Y.Doc): void {
    if (!isDocRoomName(roomName)) return

    const stored = readSnapshot(roomName)
    if (stored) {
      try {
        Y.applyUpdate(ydoc, stored)
      } catch (error) {
        logger.warn('Failed to restore document Yjs state', {
          roomName,
          error: error instanceof Error ? error.message : String(error)
        })
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
    void flush(roomName, ydoc)
  }

  function readSnapshot(roomName: string): Uint8Array | null {
    const inMemory = snapshots.get(roomName)
    if (inMemory) return inMemory
    if (!storageDir) return null

    const filePath = snapshotPath(storageDir, roomName)
    if (!existsSync(filePath)) return null
    try {
      const buffer = readFileSync(filePath)
      const update = new Uint8Array(buffer)
      snapshots.set(roomName, update)
      return update
    } catch (error) {
      logger.warn('Failed to read document Yjs snapshot', {
        roomName,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  return { bind, flush }
}

function snapshotPath(storageDir: string, roomName: string): string {
  return join(storageDir, `${Buffer.from(roomName).toString('base64url')}.bin`)
}
