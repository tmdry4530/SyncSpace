import { closePool } from './pool.js'
import { isMainModule } from './migrate.js'
import { queryOne } from './query.js'
import { readConfig } from '../config.js'
import { registerAgent } from '../auth/agentRegistration.js'
import { getAgentBySlug } from './repositories/agentRepository.js'
import { seedDemoMission } from '../demo/missionDemo.js'

/**
 * Idempotent development seed. Registers one demo agent (which also provisions a
 * workspace and the default collaborator roster) and prints its credential.
 *
 * The secret is only ever shown at registration, so re-running the seed against a
 * database that already has agents is a no-op (it cannot reprint the secret).
 */
export async function seed(logger: (message: string) => void = (m) => console.log(m)): Promise<void> {
  const existing = await queryOne<{ count: string }>(`select count(*)::text as count from agents`)
  if (existing && Number(existing.count) > 0) {
    logger('agents already present; skipping seed (secrets are only shown at registration time)')
    return
  }

  const config = readConfig()
  const result = await registerAgent(config, {
    displayName: 'Ada',
    slug: 'ada',
    role: 'planner',
    description: '데모 에이전트 (seed)'
  })

  logger(`registered demo agent ${result.credential.agentId} in workspace ${result.workspace.id}`)
  logger(`DEMO_AGENT_ID=${result.credential.agentId}`)
  logger(`DEMO_SECRET=${result.credential.secret}`)

  // Seed the demo mission using the orchestrator agent so all FKs are valid.
  const workspaceId = result.workspace.id
  const createdByParticipantId = result.identity.participantId

  // Prefer the orchestrator from the default roster; fall back to the registered agent.
  const orchestrator = await getAgentBySlug(workspaceId, 'orchestrator')
  const agentId = orchestrator?.id ?? result.credential.agentId

  try {
    const { taskId } = await seedDemoMission({ workspaceId, agentId, createdByParticipantId })
    logger('DEMO mission seeded — open the Mission View at:')
    logger(`http://localhost:5173/w/${workspaceId}/mission/${taskId}`)
  } catch (err) {
    logger(`WARNING: demo mission seed failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function main(): Promise<void> {
  try {
    await seed()
    console.log(JSON.stringify({ ok: true }))
    await closePool()
    process.exit(0)
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
    await closePool().catch(() => undefined)
    process.exit(1)
  }
}

if (isMainModule(import.meta.url)) {
  void main()
}
