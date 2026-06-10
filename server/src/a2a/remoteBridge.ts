import type { Logger } from '../utils/logger.js'
import { hashToken, newUuid } from '../utils/crypto.js'
import { withTransaction } from '../db/query.js'
import { getTask, type A2aTaskRow } from '../db/repositories/a2aRepository.js'
import { getRemoteAgentParticipantId, type RemoteAgentRow } from '../db/repositories/remoteAgentRepository.js'
import { tryClaimRemoteEvent } from '../db/repositories/remoteEventDedupRepository.js'
import { persistMessage } from '../db/repositories/messageRepository.js'
import { addAgentMessage, addTaskArtifact, setTaskStatus } from './taskService.js'
import type { RemoteTarget } from './client.js'
import { isTerminalState, type A2aMessage, type A2aTaskState, type Part, type Task } from './types.js'

/**
 * Shared bridge that reflects a remote agent's task state + outputs into the
 * local proxy task, the A2A event stream, AND the channel chat. Used by both the
 * polling worker and the inbound push-callback route, so a remote agent's replies
 * surface in the channel exactly like an internal agent's — every artifact and
 * message mirrored at most once (dedup via remote_a2a_event_dedup).
 */

export interface RemoteBridgeDeps {
  logger: Logger
}

const VALID_STATES: ReadonlySet<string> = new Set<A2aTaskState>([
  'TASK_STATE_UNSPECIFIED', 'TASK_STATE_SUBMITTED', 'TASK_STATE_WORKING', 'TASK_STATE_INPUT_REQUIRED',
  'TASK_STATE_AUTH_REQUIRED', 'TASK_STATE_COMPLETED', 'TASK_STATE_FAILED', 'TASK_STATE_CANCELED', 'TASK_STATE_REJECTED'
])

export function statusMessage(text: string): A2aMessage {
  return { messageId: newUuid(), role: 'ROLE_AGENT', parts: [{ text }] }
}

export function buildRemoteTarget(remote: RemoteAgentRow): RemoteTarget {
  return {
    endpointUrl: remote.endpoint_url,
    authScheme: remote.auth_scheme,
    credential: null, // MVP: auth_scheme='none' only; encrypted credentials are a fast-follow.
    protocolVersion: remote.protocol_version
  }
}

function mapState(state: unknown): A2aTaskState {
  return typeof state === 'string' && VALID_STATES.has(state) ? (state as A2aTaskState) : 'TASK_STATE_WORKING'
}

function firstText(parts: Part[]): string {
  for (const part of parts) {
    if ('text' in part && typeof part.text === 'string') return part.text
  }
  return ''
}

/**
 * Mirror one remote-agent message into the channel chat as the remote participant.
 * Best-effort: a channel-write failure must never abort task bridging. Idempotent
 * via clientId (channel_id, client_id) on top of the per-task dedup claim.
 *
 * Note: remote-agent output deliberately does NOT auto-activate internal agents
 * (no mention dispatch here). A remote agent is external/untrusted — letting its
 * reply text spawn internal-agent tasks with attacker-chosen instructions is a
 * trust-boundary violation. Remote replies appear in the channel; handoffs TO
 * teammates only originate from first-party (human or internal-agent) output.
 */
async function mirrorToChannel(
  localTask: A2aTaskRow,
  participantId: string,
  text: string,
  localMessageId: string,
  deps: RemoteBridgeDeps
): Promise<void> {
  if (!localTask.channel_id) return
  const content = text.slice(0, 4000) || '(remote agent message)'
  await persistMessage({
    channelId: localTask.channel_id,
    content,
    authorParticipantId: participantId,
    authorType: 'agent',
    agentId: null, // remote agents are not rows in the internal `agents` table; identity is the participant
    a2aMessageId: localMessageId,
    clientId: `a2a:${localMessageId}`,
    metadata: { taskId: localTask.id, source: 'remote_agent' }
  }).catch((error) => deps.logger.warn('Failed to mirror remote chat message', { taskId: localTask.id, error: String(error) }))
}

/** Mirror remote artifacts + agent messages into local events + channel, each exactly once. */
async function mirrorRemoteOutputs(
  localTask: A2aTaskRow,
  remoteAgentId: string,
  remoteTask: Task,
  deps: RemoteBridgeDeps
): Promise<void> {
  for (const artifact of remoteTask.artifacts ?? []) {
    if (!artifact.artifactId) continue
    // Claim + write share one transaction: if the write fails the claim rolls back,
    // so the artifact is retried on the next poll/callback rather than lost forever.
    await withTransaction(async (client) => {
      if (await tryClaimRemoteEvent(localTask.id, `artifact:${artifact.artifactId}`, client)) {
        await addTaskArtifact(
          localTask.id,
          localTask.context_id,
          {
            artifactId: artifact.artifactId,
            ...(artifact.name ? { name: artifact.name } : {}),
            ...(artifact.description ? { description: artifact.description } : {}),
            parts: artifact.parts ?? []
          },
          client
        )
      }
    })
  }

  const participantId = await getRemoteAgentParticipantId(remoteAgentId)
  if (!participantId) return
  for (const msg of remoteTask.history ?? []) {
    if (msg.role !== 'ROLE_AGENT') continue
    const text = firstText(msg.parts ?? [])
    if (!text) continue
    // Id-less messages dedup by content hash so repeated polls don't re-mirror them.
    const key = msg.messageId ? `message:${msg.messageId}` : `message:hash:${hashToken(text, null).slice(0, 16)}`
    // Atomic claim + a2a-message write; the channel mirror stays best-effort outside
    // the txn (a chat-mirror failure must not lose the authoritative task message).
    const localMessageId = await withTransaction(async (client) => {
      if (!(await tryClaimRemoteEvent(localTask.id, key, client))) return null
      const id = newUuid()
      await addAgentMessage(localTask.id, localTask.context_id, { messageId: id, parts: [{ text }], participantId }, client)
      return id
    })
    if (localMessageId) await mirrorToChannel(localTask, participantId, text, localMessageId, deps)
  }
}

/** Reflect a remote task's current state into the local proxy task + event stream + channel. */
export async function bridgeRemoteTaskIntoLocal(
  localTask: A2aTaskRow,
  remoteAgentId: string,
  remoteTask: Task,
  deps: RemoteBridgeDeps
): Promise<A2aTaskState> {
  const state = mapState(remoteTask.status?.state)
  // Re-read the freshest status so a concurrent poll + callback don't emit a
  // duplicate status_update event for the same transition.
  const current = await getTask(localTask.id)
  if (current && current.status_state !== state) {
    await setTaskStatus(
      localTask.id,
      state,
      statusMessage(isTerminalState(state) ? '원격 에이전트가 작업을 마쳤습니다.' : '원격 에이전트가 처리 중입니다.')
    )
  }
  await mirrorRemoteOutputs(localTask, remoteAgentId, remoteTask, deps)
  return state
}

/**
 * Bridge an inline (taskless) remote reply into the local task + channel chat.
 * Dedup-claimed by content hash so a send-job retry can't re-mirror the same reply
 * (the send job is not terminal until after this runs).
 */
export async function bridgeInlineMessage(
  localTask: A2aTaskRow,
  remoteAgentId: string,
  parts: Part[],
  deps: RemoteBridgeDeps
): Promise<void> {
  const participantId = await getRemoteAgentParticipantId(remoteAgentId)
  if (!participantId) return
  const text = firstText(parts)
  const key = `inline:${hashToken(text, null).slice(0, 16)}`
  const localMessageId = await withTransaction(async (client) => {
    if (!(await tryClaimRemoteEvent(localTask.id, key, client))) return null
    const id = newUuid()
    await addAgentMessage(localTask.id, localTask.context_id, { messageId: id, parts, participantId }, client)
    return id
  })
  if (localMessageId) await mirrorToChannel(localTask, participantId, text, localMessageId, deps)
}
