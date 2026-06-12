import type { ServerConfig } from '../../config.js'
import type { Router } from '../router.js'
import { json } from '../response.js'
import { notFound } from '../errors.js'
import { requireWorkspaceMember } from '../../auth/middleware.js'
import {
  getContext,
  listEventsByContext,
  listContextTasks
} from '../../db/repositories/a2aRepository.js'
import { query } from '../../db/query.js'
import { getAgentById } from '../../db/repositories/agentRepository.js'
import { mapEventRowToStreamResponse } from '../../a2a/mapper.js'
import { ENGINEERING_EVENT_TYPES } from '../../a2a/engineeringEvents.js'

export function registerMissionRoutes(router: Router, config: ServerConfig): void {
  /**
   * GET /api/missions/:contextId
   *
   * Read-only Mission View endpoint: returns the full engineering timeline for
   * a shared a2a context (= one mission), all tasks that participated, and the
   * distinct set of agents involved.
   *
   * SECURITY: context.workspace_id is authoritative — we never trust a
   * caller-supplied workspace parameter.  Cross-workspace access returns 404.
   */
  router.get('/api/missions/:contextId', async (ctx) => {
    const contextId = ctx.params.contextId ?? ''

    const context = await getContext(contextId)
    if (!context) throw notFound('미션을 찾을 수 없습니다.')

    // Gate by the CONTEXT's workspace — not any caller-supplied value.
    // requireWorkspaceMember returns 404 for mismatches, preventing IDOR.
    await requireWorkspaceMember(ctx, config, context.workspace_id)

    const [eventRows, taskRows] = await Promise.all([
      listEventsByContext(contextId),
      listContextTasks(contextId)
    ])

    // Resolve distinct agent IDs across all tasks.
    const agentIdSet = new Set<string>()
    for (const task of taskRows) {
      if (task.agent_id) agentIdSet.add(task.agent_id)
    }

    const agentProfiles = await Promise.all(
      Array.from(agentIdSet).map((id) => getAgentById(id))
    )

    const agents = agentProfiles
      .filter((a): a is NonNullable<typeof a> => a !== null)
      .map((a) => ({
        agentId: a.id,
        slug: a.slug,
        displayName: a.display_name,
        role: a.role
      }))

    const events = eventRows
      .filter((row) => row.visible_to_user)
      .map((row) => ({
        seq: row.seq,
        taskId: row.task_id,
        type: row.event_type,
        createdAt: row.created_at,
        payload: mapEventRowToStreamResponse(row)
      }))

    const tasks = taskRows.map((t) => ({
      taskId: t.id,
      agentId: t.agent_id,
      statusState: t.status_state,
      title: t.title,
      createdAt: t.created_at
    }))

    return json({
      mission: {
        contextId: context.id,
        workspaceId: context.workspace_id,
        channelId: context.channel_id,
        createdAt: context.created_at
      },
      events,
      tasks,
      agents
    })
  })

  /**
   * GET /api/workspaces/:workspaceId/missions
   *
   * List all missions (a2a contexts that have at least one engineering event)
   * for a workspace, newest first, each with a summary.
   *
   * SECURITY: requireWorkspaceMember gates by the URL workspaceId.
   */
  router.get('/api/workspaces/:workspaceId/missions', async (ctx) => {
    const workspaceId = ctx.params.workspaceId ?? ''
    await requireWorkspaceMember(ctx, config, workspaceId)

    // Inline the engineering type list as SQL literals (safe — values are
    // compile-time string constants from ENGINEERING_EVENT_TYPES).
    const engineeringTypes = ENGINEERING_EVENT_TYPES.map((t) => `'${t}'`).join(', ')

    const rows = await query<{
      context_id: string
      channel_id: string | null
      context_created_at: string
      first_task_title: string | null
      latest_event_at: string
      agent_count: string
      event_count: string
    }>(
      `select
         c.id                            as context_id,
         c.channel_id,
         c.created_at                    as context_created_at,
         (select t.title from a2a_tasks t
          where t.context_id = c.id order by t.created_at asc limit 1)
                                          as first_task_title,
         max(e.created_at)               as latest_event_at,
         count(distinct t2.agent_id)
           filter (where t2.agent_id is not null)
                                          as agent_count,
         count(e.id)                     as event_count
       from a2a_contexts c
       join a2a_task_events e on e.context_id = c.id
         and e.event_type in (${engineeringTypes})
       join a2a_tasks t2 on t2.context_id = c.id
       where c.workspace_id = $1
       group by c.id, c.channel_id, c.created_at
       order by max(e.created_at) desc`,
      [workspaceId]
    )

    const missions = rows.map((row) => ({
      contextId: row.context_id,
      channelId: row.channel_id,
      title: row.first_task_title ?? null,
      agentCount: Number(row.agent_count),
      eventCount: Number(row.event_count),
      updatedAt: row.latest_event_at,
      createdAt: row.context_created_at
    }))

    return json({ missions })
  })
}
