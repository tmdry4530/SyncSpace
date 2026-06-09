import type { AuthUser } from '../types/contracts'
import { getBackendJson, postBackendJson } from './backendClient'

export async function login(input: { email: string; password: string }): Promise<AuthUser> {
  const result = await postBackendJson<{ user: AuthUser }>('/api/auth/login', input)
  return result.user
}

export async function register(input: {
  email: string
  password: string
  displayName?: string
  color?: string
}): Promise<AuthUser> {
  const result = await postBackendJson<{ user: AuthUser }>('/api/auth/register', input)
  return result.user
}

export async function logout(): Promise<void> {
  await postBackendJson<{ ok: true }>('/api/auth/logout')
}

export async function fetchMe(): Promise<AuthUser | null> {
  const result = await getBackendJson<{ user: AuthUser | null }>('/api/auth/me')
  return result.user
}
