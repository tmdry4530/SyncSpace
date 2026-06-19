import { readClientEnv } from '../types/env'

export async function getBackendJson<TResponse>(path: string): Promise<TResponse> {
  return requestBackendJson<TResponse>(path, { method: 'GET' })
}

export async function postBackendJson<TResponse>(path: string, body?: unknown): Promise<TResponse> {
  return requestBackendJson<TResponse>(path, {
    method: 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
}

export async function deleteBackendJson<TResponse>(path: string): Promise<TResponse> {
  return requestBackendJson<TResponse>(path, { method: 'DELETE' })
}

async function requestBackendJson<TResponse>(path: string, init: RequestInit): Promise<TResponse> {
  const response = await fetch(`${readClientEnv().apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...init.headers
    }
  })

  const payload = (await response.json().catch(() => null)) as unknown
  if (!response.ok) {
    const message = isErrorPayload(payload) ? payload.message : '서버 요청 처리 중 문제가 발생했습니다.'
    const error = new Error(message)
    error.name = isErrorPayload(payload) ? payload.code : `http_${response.status}`
    throw error
  }

  return payload as TResponse
}

function isErrorPayload(value: unknown): value is { code: string; message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string' &&
    typeof (value as { message?: unknown }).message === 'string'
  )
}
