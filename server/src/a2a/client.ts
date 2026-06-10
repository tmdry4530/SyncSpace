import { safeHttp, SafeHttpError } from './safeHttp.js'
import type { A2aMessage, Task } from './types.js'

const CALL_TIMEOUT_MS = 10_000
const MAX_BODY_BYTES = 256 * 1024

export interface RemoteTarget {
  endpointUrl: string
  authScheme: 'none' | 'bearer' | 'api_key'
  credential?: string | null
  protocolVersion?: string | null
}

export class RemoteCallError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'RemoteCallError'
  }
}

/** Normalized `message:send` outcome — never throws (errors are a variant). */
export type RemoteSendResult =
  | { kind: 'task'; task: Task }
  | { kind: 'message'; message: A2aMessage }
  | { kind: 'error'; error: { code: string; message: string } }

function authHeaders(target: RemoteTarget): Record<string, string> {
  if (target.authScheme === 'bearer' && target.credential) return { authorization: `Bearer ${target.credential}` }
  if (target.authScheme === 'api_key' && target.credential) return { 'x-api-key': target.credential }
  return {}
}

function base(target: RemoteTarget): string {
  return target.endpointUrl.replace(/\/$/, '')
}

async function call(url: string, init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string }): Promise<unknown> {
  let res
  try {
    res = await safeHttp(url, {
      method: init.method,
      headers: init.headers,
      ...(init.body ? { body: init.body } : {}),
      maxBytes: MAX_BODY_BYTES,
      timeoutMs: CALL_TIMEOUT_MS
    })
  } catch (error) {
    if (error instanceof SafeHttpError) throw new RemoteCallError(error.code, error.message)
    throw new RemoteCallError('call_failed', error instanceof Error ? error.message : String(error))
  }
  if (res.status < 200 || res.status >= 300) {
    throw new RemoteCallError('remote_error', `Remote A2A ${url} returned ${res.status}: ${res.text.slice(0, 200)}`)
  }
  if (!res.text) return {}
  try {
    return JSON.parse(res.text)
  } catch {
    throw new RemoteCallError('invalid_json', 'Remote response is not valid JSON.')
  }
}

/**
 * Outbound `message:send`. Normalizes into task / immediate-message / error so the
 * worker can handle a remote that returns a Task, an inline message, or fails.
 */
export async function remoteSendMessage(target: RemoteTarget, message: A2aMessage): Promise<RemoteSendResult> {
  let data: unknown
  try {
    data = await call(`${base(target)}/message:send`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'a2a-version': target.protocolVersion ?? '1.0',
        ...authHeaders(target)
      },
      body: JSON.stringify({ message })
    })
  } catch (error) {
    if (error instanceof RemoteCallError) return { kind: 'error', error: { code: error.code, message: error.message } }
    return { kind: 'error', error: { code: 'call_failed', message: error instanceof Error ? error.message : String(error) } }
  }
  const obj = data as { task?: Task; message?: A2aMessage }
  if (obj.task && typeof obj.task.id === 'string') return { kind: 'task', task: obj.task }
  if (obj.message && typeof obj.message.messageId === 'string') return { kind: 'message', message: obj.message }
  return { kind: 'error', error: { code: 'malformed_response', message: 'Remote did not return a task or message.' } }
}

/** Outbound `tasks/{id}` fetch to poll a remote task's state. Throws RemoteCallError on failure. */
export async function remoteGetTask(target: RemoteTarget, remoteTaskId: string): Promise<Task> {
  const data = (await call(`${base(target)}/tasks/${encodeURIComponent(remoteTaskId)}`, {
    method: 'GET',
    headers: { accept: 'application/json', ...authHeaders(target) }
  })) as { task?: Task }
  if (!data.task) throw new RemoteCallError('no_task', 'Remote tasks/{id} did not return a task.')
  return data.task
}

export interface RemoteSetPushResult {
  ok: boolean
  code?: string
}

/**
 * Outbound `tasks/{id}/pushNotificationConfigs` — register our callback URL so the
 * remote pushes status/artifact updates to us in real time. Best-effort (never
 * throws): if the remote doesn't support push we fall back to polling.
 */
export async function remoteSetPushConfig(
  target: RemoteTarget,
  remoteTaskId: string,
  cfg: { url: string; token: string }
): Promise<RemoteSetPushResult> {
  try {
    await call(`${base(target)}/tasks/${encodeURIComponent(remoteTaskId)}/pushNotificationConfigs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'a2a-version': target.protocolVersion ?? '1.0',
        ...authHeaders(target)
      },
      body: JSON.stringify({ pushNotificationConfig: { url: cfg.url, token: cfg.token } })
    })
    return { ok: true }
  } catch (error) {
    if (error instanceof RemoteCallError) return { ok: false, code: error.code }
    return { ok: false, code: 'call_failed' }
  }
}

/** Outbound `tasks/{id}:cancel`. Throws RemoteCallError on failure. */
export async function remoteCancelTask(target: RemoteTarget, remoteTaskId: string): Promise<Task> {
  const data = (await call(`${base(target)}/tasks/${encodeURIComponent(remoteTaskId)}:cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(target) }
  })) as { task?: Task }
  if (!data.task) throw new RemoteCallError('no_task', 'Remote cancel did not return a task.')
  return data.task
}
