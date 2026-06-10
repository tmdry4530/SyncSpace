import type { AgentRole } from '../types/contracts.js'
import type { A2aTaskState, Part } from '../a2a/types.js'

export interface AgentEmitter {
  /** Update task status and emit a status_update event (with an optional summary). */
  status(state: A2aTaskState, summaryText?: string): Promise<void>
  /** Create/replace an artifact and emit an artifact_update event. */
  artifact(input: { artifactId: string; name?: string; description?: string; parts: Part[] }): Promise<void>
  /** Post an agent message (chat summary / clarification) and emit a message event. */
  message(parts: Part[]): Promise<void>
  /** Append a markdown section to the task's bound document, if any. */
  appendDocument(markdown: string): Promise<void>
}

export interface AgentRunContext {
  taskId: string
  contextId: string
  workspaceId: string
  channelId: string | null
  documentId: string | null
  agentRole: AgentRole
  userMessageText: string
  /** Bounded oldest-first transcript of recent channel chat (absent when no channel/history). */
  conversationText?: string | null
  emit: AgentEmitter
  signal: AbortSignal
}

export interface AgentRuntime {
  role: AgentRole
  run(ctx: AgentRunContext): Promise<void>
}

export type AgentRuntimeMode = 'mock' | 'live'
