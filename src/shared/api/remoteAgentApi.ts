import {
  deleteBackendJson,
  getBackendJson,
  postBackendJson
} from './backendClient'
import type {
  A2aTask,
  RemoteAgentProfile,
  RemoteAgentRegistrationResult,
  RemoteHealthStatus
} from '../types/contracts'

const BASE = '/api/agent-directory'

export async function registerRemoteAgent(agentCardUrl: string): Promise<RemoteAgentRegistrationResult> {
  return postBackendJson<RemoteAgentRegistrationResult>(`${BASE}/register`, { agentCardUrl })
}

export async function verifyRemoteAgent(id: string): Promise<{ id: string; status: RemoteAgentProfile['verificationStatus'] }> {
  return postBackendJson<{ id: string; status: RemoteAgentProfile['verificationStatus'] }>(
    `${BASE}/${encodeURIComponent(id)}/verify`
  )
}

export async function listRemoteAgents(): Promise<RemoteAgentProfile[]> {
  const result = await getBackendJson<{ remoteAgents: RemoteAgentProfile[] }>(BASE)
  return result.remoteAgents
}

export async function getRemoteAgent(id: string): Promise<RemoteAgentProfile> {
  const result = await getBackendJson<{ remoteAgent: RemoteAgentProfile }>(`${BASE}/${encodeURIComponent(id)}`)
  return result.remoteAgent
}

export async function healthCheckRemoteAgent(id: string): Promise<{ id: string; healthStatus: RemoteHealthStatus }> {
  return postBackendJson<{ id: string; healthStatus: RemoteHealthStatus }>(
    `${BASE}/${encodeURIComponent(id)}/health-check`
  )
}

export async function deleteRemoteAgent(id: string): Promise<{ id: string }> {
  return deleteBackendJson<{ id: string }>(`${BASE}/${encodeURIComponent(id)}`)
}

export interface InvokeRemoteAgentInput {
  id: string
  content: string
  channelId?: string
}

export async function invokeRemoteAgent(input: InvokeRemoteAgentInput): Promise<A2aTask> {
  const { id, content, channelId } = input
  const result = await postBackendJson<{ task: A2aTask }>(`${BASE}/${encodeURIComponent(id)}/invoke`, {
    content,
    ...(channelId ? { channelId } : {})
  })
  return result.task
}
