import type { AuthUser } from '../types/contracts'
import { getBackendJson, postBackendJson } from './backendClient'

export interface AuthSession {
  user: AuthUser | null
  participantId: string | null
}

export async function login(input: { email: string; password: string }): Promise<AuthSession> {
  return postBackendJson<AuthSession>('/api/auth/login', input)
}

export async function register(input: {
  email: string
  password: string
  displayName?: string
  color?: string
}): Promise<AuthSession> {
  return postBackendJson<AuthSession>('/api/auth/register', input)
}

export async function logout(): Promise<void> {
  await postBackendJson<{ ok: true }>('/api/auth/logout')
}

export async function fetchMe(): Promise<AuthSession> {
  return getBackendJson<AuthSession>('/api/auth/me')
}
