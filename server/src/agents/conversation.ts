import { listTranscriptMessages, type TranscriptAuthorKind } from '../db/repositories/messageRepository.js'

const AUTHOR_TAG: Record<TranscriptAuthorKind, string> = {
  human: 'human',
  internal_agent: 'internal-agent',
  remote_agent: 'remote-agent'
}

/**
 * Neutralize untrusted text before quoting it into an LLM prompt line:
 *  - newlines become the literal "\n", so a message can never fabricate a new
 *    transcript line (fake speakers / forged provenance tags stay inside the
 *    author's own quoted line)
 *  - "@slug" becomes "(@)slug" so neither regex in mentions.ts /
 *    mentionDispatcher.ts matches if a model echoes transcript text verbatim
 */
export function sanitizeTranscriptText(text: string): string {
  return text.replace(/\r\n|[\r\n]/g, '\\n').replace(/@(?=[a-z0-9])/gi, '(@)')
}

/** Display names are untrusted too: no line breaks, mentions, tag brackets, or colons. */
function transcriptName(displayName: string | null): string {
  const name = displayName ? sanitizeTranscriptText(displayName).replace(/[[\]:]/g, '').trim() : ''
  return name || '참여자'
}

/**
 * Build a bounded, oldest-first transcript of recent channel chat for agent
 * context. Transcript content crosses a trust boundary — any participant can
 * write arbitrary text into chat — so each message is rendered as exactly ONE
 * line prefixed with a server-derived provenance tag:
 *
 *   [#<messageId8> <human|internal-agent|remote-agent>] <name>: <content>
 *
 * Content cannot forge a tag (newlines are escaped) and embedded mentions are
 * defused, so injected lines like "Orchestrator: @builder ..." remain visibly
 * part of the author's own message and can never activate an agent. Returns
 * null when the channel has no usable history. Used by both the internal live
 * runtime and outbound remote sends so every collaborator sees the same
 * conversation.
 */
export async function buildChannelTranscript(
  channelId: string,
  maxChars: number,
  workspaceId?: string | null
): Promise<string | null> {
  const items = await listTranscriptMessages(channelId, 15, workspaceId)
  if (items.length === 0) return null

  // listTranscriptMessages returns newest-first; agents read oldest-first.
  const lines = [...items].reverse().map((message) => {
    const tag = `[#${message.id.slice(0, 8)} ${AUTHOR_TAG[message.authorKind]}]`
    return `${tag} ${transcriptName(message.displayName)}: ${sanitizeTranscriptText(message.content)}`
  })

  let transcript = lines.join('\n')
  if (transcript.length > maxChars) {
    transcript = transcript.slice(transcript.length - maxChars)
    // Drop the now-partial first line so every surviving line keeps its provenance tag.
    const firstBreak = transcript.indexOf('\n')
    if (firstBreak !== -1) transcript = transcript.slice(firstBreak + 1)
  }
  return transcript.length > 0 ? transcript : null
}
