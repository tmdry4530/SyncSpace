import type { AgentRole } from '../types/contracts.js'
import { getMockRuntime } from './mockRuntimes.js'
import type { AgentRuntime, AgentRuntimeMode } from './runtime.js'

export function resolveRuntimeMode(): AgentRuntimeMode {
  return process.env.AGENT_RUNTIME_MODE === 'live' ? 'live' : 'mock'
}

/**
 * Resolve the runtime for an agent role. `live` mode would dispatch to a
 * model-provider adapter; until that exists it falls back to the deterministic
 * mock runtime (AGENT_RUNTIME_MODE=mock is the safe default).
 */
export function getAgentRuntime(role: AgentRole, _mode: AgentRuntimeMode = 'mock'): AgentRuntime {
  return getMockRuntime(role)
}
