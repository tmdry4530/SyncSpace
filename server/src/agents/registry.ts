import { readConfig, type ServerConfig } from '../config.js'
import type { AgentRole } from '../types/contracts.js'
import { getMockRuntime } from './mockRuntimes.js'
import { createLiveRuntime } from './liveRuntime.js'
import { getModelProvider } from './providers/index.js'
import type { AgentRuntime } from './runtime.js'

/**
 * Resolve the runtime for an agent role from config.
 *
 * - `AGENT_RUNTIME_MODE=mock` (default) → deterministic mock runtime.
 * - `AGENT_RUNTIME_MODE=live` → ModelProvider-backed runtime.
 *
 * Live mode never silently falls back to mock: a missing/invalid provider config
 * already fails at boot (`config.ts` → assertAgentRuntimeConfig), so a live build
 * that can't reach its provider is a hard failure, not hidden degradation.
 */
export function getAgentRuntime(role: AgentRole, config: ServerConfig = readConfig()): AgentRuntime {
  if (config.agentRuntimeMode === 'live') {
    return createLiveRuntime(role, getModelProvider(config), {
      maxTokens: config.agentLiveMaxTokens,
      timeoutMs: config.agentLiveTimeoutMs
    })
  }
  return getMockRuntime(role)
}
