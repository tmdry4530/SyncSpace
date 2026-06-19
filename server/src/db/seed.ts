import { closePool } from './pool.js'
import { isMainModule } from './migrate.js'
import { hashPassword } from '../utils/crypto.js'
import {
  createUserWithParticipant,
  findUserByEmail,
  type AppUserRow
} from './repositories/userRepository.js'
import { getHumanParticipantByUserId } from './repositories/participantRepository.js'
import {
  createWorkspace,
  joinWorkspaceByInviteCode,
  listWorkspacesForUser
} from './repositories/workspaceRepository.js'
import { createChannel, listChannels } from './repositories/channelRepository.js'
import { createDocument, listDocuments } from './repositories/documentRepository.js'
import { persistMessage } from './repositories/messageRepository.js'
import { ensureDefaultAgents } from './repositories/agentRepository.js'

const DEMO_PASSWORD = 'password123'

async function ensureUser(email: string, displayName: string, color: string): Promise<AppUserRow> {
  const existing = await findUserByEmail(email)
  if (existing) return existing
  const created = await createUserWithParticipant({
    email,
    displayName,
    color,
    passwordHash: await hashPassword(DEMO_PASSWORD)
  })
  return created.user
}

/** Idempotent development seed: two users, a demo workspace, channels, docs, agents. */
export async function seed(logger: (message: string) => void = (m) => console.log(m)): Promise<void> {
  const ada = await ensureUser('ada@syncspace.dev', 'Ada Lovelace', '#7c3aed')
  const grace = await ensureUser('grace@syncspace.dev', 'Grace Hopper', '#0891b2')

  const existingWorkspaces = await listWorkspacesForUser(ada.id)
  let workspace = existingWorkspaces.find((ws) => ws.name === 'SyncSpace Demo') ?? null
  if (!workspace) {
    workspace = await createWorkspace({ name: 'SyncSpace Demo', ownerId: ada.id })
    await joinWorkspaceByInviteCode({ inviteCode: workspace.inviteCode, userId: grace.id })
    logger(`created workspace ${workspace.id}`)
  }

  const channels = await listChannels(workspace.id)
  let general = channels.find((channel) => channel.name === 'general') ?? null
  if (!general) {
    general = await createChannel({ workspaceId: workspace.id, name: 'general', createdBy: ada.id })
    await createChannel({ workspaceId: workspace.id, name: 'docs', createdBy: ada.id })
  }

  const documents = await listDocuments(workspace.id)
  if (!documents.some((doc) => doc.title === 'Welcome to SyncSpace')) {
    await createDocument({ workspaceId: workspace.id, title: 'Welcome to SyncSpace', createdBy: ada.id })
  }

  const adaParticipant = await getHumanParticipantByUserId(ada.id)
  if (general && adaParticipant) {
    await persistMessage({
      channelId: general.id,
      content: 'Welcome to SyncSpace! (seed)',
      clientId: 'seed-hello-1',
      authorParticipantId: adaParticipant.id,
      authorType: 'human',
      userId: ada.id
    })
  }

  const agents = await ensureDefaultAgents(workspace.id, ada.id)
  logger(`workspace ${workspace.id} has ${agents.length} agents`)
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
