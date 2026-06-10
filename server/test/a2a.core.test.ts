import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startEmbeddedDatabase, type EmbeddedDatabase } from './helpers/embeddedPostgres.js'
import { setPool } from '../src/db/pool.js'
import { registerAgentFixture } from './helpers/agentFixture.js'
import { getAgentBySlug } from '../src/db/repositories/agentRepository.js'
import { listEvents } from '../src/db/repositories/a2aRepository.js'
import {
  addAgentMessage,
  addTaskArtifact,
  cancelTask,
  createTaskFromMessage,
  setTaskStatus
} from '../src/a2a/taskService.js'

let db: EmbeddedDatabase
let workspaceId: string
let agentId: string
let participantId: string

beforeAll(async () => {
  db = await startEmbeddedDatabase()
  setPool(db.pool, { external: true })

  const reg = await registerAgentFixture({ displayName: 'A2A', slug: 'a2a-owner' })
  workspaceId = reg.identity.workspaceId
  // The registered owner participant authors the task; the default planner runs it.
  participantId = reg.identity.participantId
  const planner = await getAgentBySlug(workspaceId, 'planner')
  agentId = planner!.id
}, 90_000)

afterAll(async () => {
  await db?.stop()
})

describe('A2A task lifecycle', () => {
  it('createTask -> message -> status -> artifact -> events in order', async () => {
    const { task, created } = await createTaskFromMessage({
      workspaceId,
      agentId,
      createdByParticipantId: participantId,
      message: { messageId: 'msg-1', parts: [{ text: 'Plan this feature' }] },
      enqueue: false
    })
    expect(created).toBe(true)
    expect(task.status.state).toBe('TASK_STATE_SUBMITTED')
    expect(task.contextId).toBeTruthy()

    await setTaskStatus(task.id, 'TASK_STATE_WORKING')
    await addTaskArtifact(task.id, task.contextId, {
      artifactId: 'plan.md',
      name: 'Implementation Plan',
      parts: [{ text: '# Plan\n- step 1' }]
    })
    await addAgentMessage(task.id, task.contextId, {
      messageId: 'agent-msg-1',
      parts: [{ text: 'Drafted the plan.' }]
    })
    await setTaskStatus(task.id, 'TASK_STATE_COMPLETED')

    const events = await listEvents(task.id)
    const types = events.map((event) => event.event_type)
    expect(types).toEqual(['task_snapshot', 'status_update', 'artifact_update', 'message', 'status_update'])

    // seq is strictly increasing (ordering guarantee).
    const seqs = events.map((event) => Number(event.seq))
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
  })

  it('is idempotent on duplicate messageId within a context', async () => {
    const first = await createTaskFromMessage({
      workspaceId,
      agentId,
      createdByParticipantId: participantId,
      message: { messageId: 'dup-1', parts: [{ text: 'first' }] },
      enqueue: false
    })
    const second = await createTaskFromMessage({
      workspaceId,
      agentId,
      contextId: first.task.contextId,
      createdByParticipantId: participantId,
      message: { messageId: 'dup-1', parts: [{ text: 'first' }] },
      enqueue: false
    })
    expect(second.created).toBe(false)
    expect(second.task.id).toBe(first.task.id)
  })

  it('cancel is idempotent and terminal', async () => {
    const { task } = await createTaskFromMessage({
      workspaceId,
      agentId,
      createdByParticipantId: participantId,
      message: { messageId: 'cancel-1', parts: [{ text: 'cancel me' }] },
      enqueue: false
    })
    const canceled = await cancelTask(task.id)
    expect(canceled?.status.state).toBe('TASK_STATE_CANCELED')
    const again = await cancelTask(task.id)
    expect(again?.status.state).toBe('TASK_STATE_CANCELED')
  })
})
