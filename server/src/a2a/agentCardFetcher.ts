import { safeHttp, SafeHttpError } from './safeHttp.js'
import { parseAgentCard, type ParsedAgentCard } from './agentCardSchema.js'

const FETCH_TIMEOUT_MS = 5_000
const MAX_BODY_BYTES = 64 * 1024

export class RemoteFetchError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'RemoteFetchError'
  }
}

/** SSRF-safe GET via the IP-pinning util (blocks private/loopback/metadata; refuses redirects). */
async function safeGet(rawUrl: string, accept: string): Promise<string> {
  try {
    const res = await safeHttp(rawUrl, { headers: { accept }, maxBytes: MAX_BODY_BYTES, timeoutMs: FETCH_TIMEOUT_MS })
    if (res.status < 200 || res.status >= 300) throw new RemoteFetchError('unreachable', `GET ${rawUrl} returned ${res.status}.`)
    return res.text
  } catch (error) {
    if (error instanceof RemoteFetchError) throw error
    if (error instanceof SafeHttpError) throw new RemoteFetchError(error.code, error.message)
    throw new RemoteFetchError('fetch_failed', error instanceof Error ? error.message : String(error))
  }
}

export async function fetchAgentCard(agentCardUrl: string): Promise<ParsedAgentCard> {
  const text = await safeGet(agentCardUrl, 'application/json')
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new RemoteFetchError('card_invalid_json', 'Agent card is not valid JSON.')
  }
  try {
    return parseAgentCard(json)
  } catch (error) {
    throw new RemoteFetchError('card_invalid', error instanceof Error ? error.message : 'Agent card failed validation.')
  }
}

/** Fetch the ownership-verification file from the ENDPOINT origin (not the card URL). */
export async function fetchWellKnownVerification(endpointUrl: string): Promise<string> {
  const origin = new URL(endpointUrl).origin
  return safeGet(`${origin}/.well-known/syncspace-verify.txt`, 'text/plain')
}
