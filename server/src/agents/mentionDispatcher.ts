import type { Logger } from '../utils/logger.js'
import { newUuid } from '../utils/crypto.js'
import { RateLimiter } from '../http/rateLimit.js'
import { createTaskFromMessage } from '../a2a/taskService.js'
import { resolveAgentByMention } from './resolver.js'

/**
 * Agent-to-agent collaboration loop ("moltbook-style").
 *
 * When a FIRST-PARTY agent-authored channel message mentions another agent
 * (`@slug`), the mentioned agent (internal, or a verified remote) gets its own
 * task in the same channel — so agents hand work to each other without a human.
 *
 * Trust boundary: only first-party output reaches here — human mentions go through
 * the authenticated /invoke APIs, and internal-agent output calls this from the
 * worker. Remote-agent (external, untrusted) replies deliberately do NOT dispatch
 * (see remoteBridge.mirrorToChannel), so external text can never spawn internal
 * tasks with attacker-chosen instructions.
 *
 * Runaway protection:
 *  - HARD bound: hop counter persisted in the triggering message metadata and
 *    re-read from the DB, so it holds across processes/replicas. With ≤2 mentions
 *    per message and MAX_HOPS=3, a single origin fans out to a bounded ≤14 tasks.
 *  - self-mentions ignored; at most MAX_MENTIONS_PER_MESSAGE distinct targets.
 *  - per-channel rate cap: a per-process best-effort burst guard (in-memory, NOT
 *    shared across replicas) — the hop counter, not this, is the durable bound.
 */

export const MAX_HOPS = 3
export const MAX_MENTIONS_PER_MESSAGE = 2

// Per-process burst guard (best-effort, not cross-replica): ≤20 auto-dispatched
// tasks per channel per minute. The durable cross-process bound is MAX_HOPS.
const channelLimiter = new RateLimiter(60_000, 20)

const MENTION_RE = /@([a-z0-9][a-z0-9_-]*)/gi

/** Distinct lowercase slugs mentioned in a text, capped. */
export function extractMentionSlugs(text: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(MENTION_RE)) {
    const slug = match[1]?.toLowerCase()
    if (slug && !found.includes(slug)) found.push(slug)
    if (found.length >= MAX_MENTIONS_PER_MESSAGE) break
  }
  return found
}

export interface DispatchMentionsInput {
  workspaceId: string
  channelId: string
  /** The agent-authored message text being scanned for mentions. */
  content: string
  /** Participant id of the authoring agent (becomes the task creator). */
  authorParticipantId: string
  /** Set when the author is an internal agent (self-mention guard). */
  authorInternalAgentId?: string | null
  /** Set when the author is a remote agent (self-mention guard). */
  authorRemoteAgentId?: string | null
  /** Hop count of the message that produced this output (0 = human-triggered). */
  hops: number
  /**
   * When set, the collaboration task joins the SAME a2a context as the origin
   * task so that all agents in one collaboration chain share a single mission
   * context.  The workspace IDOR guard in createTaskFromMessage (context.workspace_id
   * must equal input.workspaceId) is preserved — collaboration is same-workspace.
   */
  originContextId?: string | null
  logger: Logger
}

/**
 * Scan an agent-authored channel message for `@slug` mentions and create a task
 * for each resolved target. Never throws — collaboration must not break the
 * worker's mirror path.
 */
export async function dispatchAgentMentions(input: DispatchMentionsInput): Promise<void> {
  try {
    await dispatch(input)
  } catch (error) {
    input.logger.warn('Agent mention dispatch failed', {
      channelId: input.channelId,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

async function dispatch(input: DispatchMentionsInput): Promise<void> {
  const slugs = extractMentionSlugs(input.content)
  if (slugs.length === 0) return

  if (input.hops >= MAX_HOPS) {
    input.logger.info('Agent mention chain stopped at hop limit', { channelId: input.channelId, hops: input.hops })
    return
  }

  for (const slug of slugs) {
    if (!channelLimiter.check(input.channelId)) {
      input.logger.warn('Agent mention dispatch rate-limited', { channelId: input.channelId })
      return
    }

    const resolved = await resolveAgentByMention(input.workspaceId, slug)
    if (!resolved) continue

    if (resolved.kind === 'internal') {
      if (resolved.agent.id === input.authorInternalAgentId) continue // self-mention
      await createCollabTask(input, { agentId: resolved.agent.id }, slug)
    } else {
      if (resolved.agent.id === input.authorRemoteAgentId) continue // self-mention
      // Same gating as the unified /invoke route + remote worker.
      if (resolved.agent.verification_status !== 'verified' || resolved.agent.health_status === 'unhealthy') continue
      await createCollabTask(input, { remoteAgentId: resolved.agent.id }, slug)
    }
  }
}

async function createCollabTask(
  input: DispatchMentionsInput,
  target: { agentId?: string; remoteAgentId?: string },
  slug: string
): Promise<void> {
  await createTaskFromMessage({
    workspaceId: input.workspaceId,
    ...target,
    channelId: input.channelId,
    // Join the origin context so the entire collaboration chain (orchestrator →
    // @planner → @builder → @reviewer) shares a single a2a context = one mission.
    // createTaskFromMessage already guards context.workspace_id === workspaceId.
    ...(input.originContextId ? { contextId: input.originContextId } : {}),
    createdByParticipantId: input.authorParticipantId,
    message: {
      messageId: newUuid(),
      parts: [{ text: input.content }],
      role: 'ROLE_USER',
      metadata: { hops: input.hops + 1, trigger: 'agent_mention', mentionedSlug: slug }
    }
  })
  input.logger.info('Agent mention dispatched', { channelId: input.channelId, slug, hops: input.hops + 1 })
}

/** Read the hop count from a task's originating message metadata (0 when absent). */
export function readHops(metadata: Record<string, unknown> | null | undefined): number {
  const value = metadata?.['hops']
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0
}
