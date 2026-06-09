import type { ServerResponse } from 'node:http'
import { Client } from 'pg'
import type { ServerConfig } from '../config.js'
import type { Logger } from '../utils/logger.js'
import { EVENT_NOTIFY_CHANNEL, getEventBySeq } from '../db/repositories/a2aRepository.js'
import { mapEventRowToStreamResponse } from './mapper.js'
import type { StreamResponse } from './types.js'

export type StreamSubscriber = (event: StreamResponse, seq: string) => void

/**
 * Fan-out of A2A task events to SSE subscribers. Uses a dedicated Postgres
 * LISTEN connection so events emitted by the worker process reach API stream
 * subscribers (single-replica in-memory fanout, cross-process via NOTIFY).
 */
export class A2aStreamingHub {
  private client: Client | null = null
  private connecting: Promise<void> | null = null
  private readonly subscribers = new Map<string, Set<StreamSubscriber>>()

  constructor(
    private readonly config: ServerConfig,
    private readonly logger: Logger
  ) {}

  async ensureListening(): Promise<void> {
    if (this.client) return
    if (this.connecting) return this.connecting
    if (!this.config.databaseUrl) return

    this.connecting = (async () => {
      const client = new Client({ connectionString: this.config.databaseUrl ?? undefined })
      client.on('notification', (msg) => {
        if (msg.channel !== EVENT_NOTIFY_CHANNEL || !msg.payload) return
        void this.handleNotification(msg.payload)
      })
      client.on('error', (error) => {
        this.logger.warn('A2A streaming LISTEN connection error', { error: error.message })
      })
      await client.connect()
      await client.query(`listen ${EVENT_NOTIFY_CHANNEL}`)
      this.client = client
    })()
    try {
      await this.connecting
    } finally {
      this.connecting = null
    }
  }

  private async handleNotification(payload: string): Promise<void> {
    let taskId: string
    let seq: string
    try {
      const parsed = JSON.parse(payload) as { taskId?: string; seq?: string | number }
      if (!parsed.taskId || parsed.seq === undefined) return
      taskId = parsed.taskId
      seq = String(parsed.seq)
    } catch {
      return
    }

    const subs = this.subscribers.get(taskId)
    if (!subs || subs.size === 0) return

    const row = await getEventBySeq(seq).catch(() => null)
    if (!row) return
    const response = mapEventRowToStreamResponse(row)
    if (!response) return

    for (const subscriber of subs) {
      try {
        subscriber(response, seq)
      } catch (error) {
        this.logger.warn('A2A stream subscriber failed', { error: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  subscribe(taskId: string, subscriber: StreamSubscriber): () => void {
    let set = this.subscribers.get(taskId)
    if (!set) {
      set = new Set()
      this.subscribers.set(taskId, set)
    }
    set.add(subscriber)
    void this.ensureListening()
    return () => {
      const current = this.subscribers.get(taskId)
      if (!current) return
      current.delete(subscriber)
      if (current.size === 0) this.subscribers.delete(taskId)
    }
  }

  async close(): Promise<void> {
    this.subscribers.clear()
    const client = this.client
    this.client = null
    if (client) await client.end().catch(() => undefined)
  }
}

// ---------- SSE helpers ----------

export function startSse(res: ServerResponse, baseHeaders: Record<string, string> = {}): void {
  res.writeHead(200, {
    ...baseHeaders,
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no'
  })
  res.write(': connected\n\n')
}

export function writeSseEvent(res: ServerResponse, eventName: string, data: unknown): void {
  res.write(`event: ${eventName}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export function streamResponseEventName(response: StreamResponse): string {
  if ('task' in response) return 'message'
  if ('message' in response) return 'message'
  if ('statusUpdate' in response) return 'statusUpdate'
  return 'artifactUpdate'
}
