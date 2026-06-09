import { query, queryOne } from '../query.js'
import type { Queryable } from '../query.js'

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled'

export interface JobRow {
  id: string
  queue_name: string
  job_type: string
  status: JobStatus
  payload: Record<string, unknown>
  attempts: number
  max_attempts: number
  run_after: string
  locked_by: string | null
  locked_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export async function enqueueJob(
  input: {
    queueName: string
    jobType: string
    payload: Record<string, unknown>
    runAfter?: Date
    maxAttempts?: number
  },
  client?: Queryable
): Promise<JobRow> {
  const rows = await query<JobRow>(
    `insert into jobs (queue_name, job_type, payload, run_after, max_attempts)
     values ($1, $2, $3::jsonb, coalesce($4::timestamptz, now()), coalesce($5, 5))
     returning *`,
    [
      input.queueName,
      input.jobType,
      JSON.stringify(input.payload),
      input.runAfter ? input.runAfter.toISOString() : null,
      input.maxAttempts ?? null
    ],
    client
  )
  const row = rows[0]
  if (!row) throw new Error('Failed to enqueue job')
  return row
}

/** Atomically claim the next ready job for a queue using FOR UPDATE SKIP LOCKED. */
export async function claimJob(queueName: string, workerId: string, client?: Queryable): Promise<JobRow | null> {
  return queryOne<JobRow>(
    `with next_job as (
       select id from jobs
       where queue_name = $1 and status = 'queued' and run_after <= now()
       order by created_at asc
       for update skip locked
       limit 1
     )
     update jobs j
     set status = 'running', locked_by = $2, locked_at = now(), attempts = j.attempts + 1, updated_at = now()
     from next_job
     where j.id = next_job.id
     returning j.*`,
    [queueName, workerId],
    client
  )
}

export async function completeJob(id: string, client?: Queryable): Promise<void> {
  await query(`update jobs set status = 'completed', updated_at = now() where id = $1`, [id], client)
}

export async function rescheduleJob(id: string, error: string, backoffMs: number, client?: Queryable): Promise<void> {
  await query(
    `update jobs
     set status = 'queued', locked_by = null, locked_at = null,
         last_error = $2, run_after = now() + ($3::int * interval '1 millisecond'), updated_at = now()
     where id = $1`,
    [id, error.slice(0, 2000), Math.round(backoffMs)],
    client
  )
}

export async function failJob(id: string, error: string, client?: Queryable): Promise<void> {
  await query(
    `update jobs set status = 'failed', last_error = $2, updated_at = now() where id = $1`,
    [id, error.slice(0, 2000)],
    client
  )
}

export async function getQueueStats(client?: Queryable): Promise<{ queuedJobs: number; runningJobs: number }> {
  const row = await queryOne<{ queued: string; running: string }>(
    `select
       count(*) filter (where status = 'queued')::text as queued,
       count(*) filter (where status = 'running')::text as running
     from jobs`,
    [],
    client
  )
  return { queuedJobs: Number(row?.queued ?? '0'), runningJobs: Number(row?.running ?? '0') }
}
