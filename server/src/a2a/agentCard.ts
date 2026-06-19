import type { ServerConfig } from '../config.js'

export interface AgentCardSkill {
  id: string
  name: string
  description: string
  tags: string[]
  inputModes: string[]
  outputModes: string[]
}

export interface AgentCard {
  name: string
  description: string
  supportedInterfaces: { url: string; protocolBinding: string; protocolVersion: string }[]
  capabilities: { streaming: boolean; pushNotifications: boolean; extendedAgentCard: boolean }
  defaultInputModes: string[]
  defaultOutputModes: string[]
  skills: AgentCardSkill[]
  securitySchemes: Record<string, unknown>
  security: Record<string, unknown>[]
}

const SKILLS: AgentCardSkill[] = [
  {
    id: 'plan-feature',
    name: 'Plan Feature',
    description: 'Creates requirements, task breakdowns, risks, and implementation plans.',
    tags: ['planning', 'requirements', 'architecture'],
    inputModes: ['text/plain', 'text/markdown'],
    outputModes: ['text/markdown', 'application/json']
  },
  {
    id: 'review-plan',
    name: 'Review Plan',
    description: 'Reviews a plan for security, feasibility, scope risk, and missing requirements.',
    tags: ['review', 'risk', 'security'],
    inputModes: ['text/plain', 'text/markdown'],
    outputModes: ['text/markdown']
  },
  {
    id: 'write-document',
    name: 'Write Document',
    description: 'Writes structured project documentation into the selected SyncSpace document.',
    tags: ['documentation', 'markdown', 'workspace'],
    inputModes: ['text/plain', 'application/json'],
    outputModes: ['text/markdown']
  }
]

/** Public Agent Card served at /.well-known/agent-card.json (no secrets). */
export function buildPublicAgentCard(config: ServerConfig): AgentCard {
  return {
    name: 'SyncSpace Agent Orchestrator',
    description: 'Coordinates planner, builder, reviewer, and document-writing agents inside SyncSpace workspaces.',
    supportedInterfaces: [
      {
        url: config.a2aInterfaceUrl,
        protocolBinding: 'HTTP+JSON',
        protocolVersion: config.a2aVersion
      }
    ],
    capabilities: {
      streaming: true,
      pushNotifications: true,
      extendedAgentCard: true
    },
    defaultInputModes: ['text/plain', 'application/json', 'text/markdown'],
    defaultOutputModes: ['text/plain', 'application/json', 'text/markdown'],
    skills: SKILLS,
    securitySchemes: {
      bearer: {
        httpAuthSecurityScheme: { scheme: 'Bearer' }
      }
    },
    security: [{ bearer: [] }]
  }
}

/** Authenticated extended card; may include richer skill/runtime detail. */
export function buildExtendedAgentCard(config: ServerConfig): AgentCard & { extended: { agentRoles: string[] } } {
  return {
    ...buildPublicAgentCard(config),
    extended: {
      agentRoles: ['planner', 'builder', 'reviewer', 'doc_writer', 'orchestrator']
    }
  }
}
