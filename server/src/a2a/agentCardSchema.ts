import { z } from 'zod'

/**
 * Lenient validator for a third-party Agent Card. We only require enough to
 * locate the A2A endpoint and a display name; everything else is best-effort.
 */
const InterfaceSchema = z.object({
  url: z.string().url(),
  protocolBinding: z.string().optional(),
  protocolVersion: z.string().optional()
})

export const RemoteAgentCardSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    url: z.string().url().optional(),
    supportedInterfaces: z.array(InterfaceSchema).optional(),
    protocolVersion: z.string().optional(),
    skills: z.array(z.unknown()).optional(),
    capabilities: z.record(z.string(), z.unknown()).optional()
  })
  .refine((c) => Boolean(c.url) || (Array.isArray(c.supportedInterfaces) && c.supportedInterfaces.length > 0), {
    message: 'Agent card must declare a top-level "url" or at least one "supportedInterfaces" entry.'
  })

export type RemoteAgentCard = z.infer<typeof RemoteAgentCardSchema>

export interface ParsedAgentCard {
  name: string
  description: string | null
  endpointUrl: string
  protocolVersion: string | null
  skills: unknown[]
  capabilities: Record<string, unknown>
}

/** Parse + normalize a raw card. Throws ZodError on invalid input. */
export function parseAgentCard(raw: unknown): ParsedAgentCard {
  const card = RemoteAgentCardSchema.parse(raw)
  const endpointUrl = card.supportedInterfaces?.[0]?.url ?? card.url
  if (!endpointUrl) {
    throw new Error('Agent card has no resolvable A2A endpoint URL.')
  }
  const protocolVersion = card.supportedInterfaces?.[0]?.protocolVersion ?? card.protocolVersion ?? null
  return {
    name: card.name,
    description: card.description ?? null,
    endpointUrl,
    protocolVersion,
    skills: card.skills ?? [],
    capabilities: card.capabilities ?? {}
  }
}
