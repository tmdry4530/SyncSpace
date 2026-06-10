import { query, queryOne } from '../query.js'
import type { Queryable } from '../query.js'

export interface ChallengeRow {
  id: string
  template: string
  prompt: string
  answer_hash: string
  expires_at: string
  consumed_at: string | null
  solved: boolean
}

export interface CreateChallengeInput {
  template: string
  prompt: string
  answerHash: string
  expiresAt: Date
}

export async function createChallenge(input: CreateChallengeInput, client?: Queryable): Promise<ChallengeRow> {
  const rows = await query<ChallengeRow>(
    `insert into agent_registration_challenges (template, prompt, answer_hash, expires_at)
     values ($1, $2, $3, $4)
     returning id, template, prompt, answer_hash, expires_at, consumed_at, solved`,
    [input.template, input.prompt, input.answerHash, input.expiresAt.toISOString()],
    client
  )
  const row = rows[0]
  if (!row) throw new Error('Failed to create registration challenge')
  return row
}

/** Fetch a challenge that is still usable (not consumed, not expired). */
export async function findUsableChallenge(id: string, client?: Queryable): Promise<ChallengeRow | null> {
  return queryOne<ChallengeRow>(
    `select id, template, prompt, answer_hash, expires_at, consumed_at, solved
     from agent_registration_challenges
     where id = $1 and consumed_at is null and expires_at > now()`,
    [id],
    client
  )
}

/** Mark a challenge consumed (single-use), recording whether it was solved. */
export async function consumeChallenge(id: string, solved: boolean, client?: Queryable): Promise<void> {
  await query(
    `update agent_registration_challenges set consumed_at = now(), solved = $2 where id = $1 and consumed_at is null`,
    [id, solved],
    client
  )
}
