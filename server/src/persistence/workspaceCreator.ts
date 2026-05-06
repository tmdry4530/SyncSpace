import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { ServerConfig } from '../config.js'
import { hasSupabaseAdminConfig } from '../config.js'
import type { Workspace } from '../types/contracts.js'
import type { Logger } from '../utils/logger.js'
import { createSupabaseAdminClient } from './supabaseAdmin.js'

const STARTER_CHANNEL_NAME = 'general'
const STARTER_DOCUMENT_TITLE = 'Welcome to SyncSpace'

export interface CreateWorkspaceInput {
  name: string
  accessToken: string
}

export interface WorkspaceCreator {
  createWorkspace(input: CreateWorkspaceInput): Promise<Workspace>
}

export class WorkspaceCreateError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'WorkspaceCreateError'
  }
}

export class DisabledWorkspaceCreator implements WorkspaceCreator {
  async createWorkspace(): Promise<Workspace> {
    throw new WorkspaceCreateError(503, 'workspace_create_unavailable', '워크스페이스 생성을 위한 서버 설정이 없습니다.')
  }
}

export class SupabaseWorkspaceCreator implements WorkspaceCreator {
  constructor(
    private readonly client: SupabaseClient,
    private readonly logger: Logger
  ) {}

  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    const name = input.name.trim()
    if (!name || name.length > 120) {
      throw new WorkspaceCreateError(400, 'invalid_workspace_name', '워크스페이스 이름은 1~120자로 입력해주세요.')
    }

    const user = await this.authenticate(input.accessToken)
    await this.ensureProfile(user)

    const workspaceResult = await this.client
      .from('workspaces')
      .insert({ name, owner_id: user.id })
      .select('id,name,owner_id,invite_code,created_at')
      .single()

    if (workspaceResult.error || !workspaceResult.data) {
      this.logger.warn('Failed to create workspace', { userId: user.id, error: workspaceResult.error?.message })
      throw new WorkspaceCreateError(500, 'workspace_create_failed', '워크스페이스를 만들지 못했습니다.')
    }

    const workspace = mapWorkspaceRow(workspaceResult.data)
    try {
      await this.createStarterItems({ workspaceId: workspace.id, userId: user.id })
    } catch (error) {
      await this.rollbackWorkspace(workspace.id)
      throw error
    }
    return workspace
  }

  private async authenticate(accessToken: string): Promise<User> {
    if (!accessToken) {
      throw new WorkspaceCreateError(401, 'missing_access_token', '로그인이 필요합니다.')
    }

    const result = await this.client.auth.getUser(accessToken)
    const user = result.data?.user
    if (result.error || !user) {
      throw new WorkspaceCreateError(401, 'invalid_access_token', '로그인 세션이 유효하지 않습니다.')
    }
    return user
  }

  private async ensureProfile(user: User): Promise<void> {
    const result = await this.client.from('profiles').upsert(
      {
        id: user.id,
        display_name: user.user_metadata?.displayName || user.email?.split('@')[0] || 'SyncSpace User',
        avatar_url: user.user_metadata?.avatarUrl ?? null,
        color: user.user_metadata?.color || '#64748b'
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )

    if (result.error) {
      this.logger.warn('Failed to ensure profile before workspace create', { userId: user.id, error: result.error.message })
      throw new WorkspaceCreateError(500, 'profile_sync_failed', '사용자 프로필을 준비하지 못했습니다.')
    }
  }

  private async rollbackWorkspace(workspaceId: string): Promise<void> {
    const result = await this.client.from('workspaces').delete().eq('id', workspaceId)
    if (result.error) {
      this.logger.warn('Failed to roll back workspace after starter item failure', { workspaceId, error: result.error.message })
    }
  }

  private async createStarterItems(input: { workspaceId: string; userId: string }): Promise<void> {
    const channelResult = await this.client
      .from('channels')
      .insert({ workspace_id: input.workspaceId, name: STARTER_CHANNEL_NAME, created_by: input.userId })

    if (channelResult.error) {
      this.logger.warn('Failed to create starter channel', { workspaceId: input.workspaceId, error: channelResult.error.message })
      throw new WorkspaceCreateError(500, 'starter_channel_create_failed', '기본 채널을 만들지 못했습니다.')
    }

    const documentResult = await this.client
      .from('documents')
      .insert({ workspace_id: input.workspaceId, title: STARTER_DOCUMENT_TITLE, created_by: input.userId })

    if (documentResult.error) {
      this.logger.warn('Failed to create starter document', { workspaceId: input.workspaceId, error: documentResult.error.message })
      throw new WorkspaceCreateError(500, 'starter_document_create_failed', '기본 문서를 만들지 못했습니다.')
    }
  }
}

export function createWorkspaceCreator(config: ServerConfig, logger: Logger): WorkspaceCreator {
  if (!hasSupabaseAdminConfig(config)) {
    logger.warn('Supabase service-role configuration is missing; workspace create endpoint is disabled')
    return new DisabledWorkspaceCreator()
  }

  return new SupabaseWorkspaceCreator(createSupabaseAdminClient(config), logger)
}

function mapWorkspaceRow(row: Record<string, unknown>): Workspace {
  return {
    id: String(row.id),
    name: String(row.name),
    ownerId: String(row.owner_id),
    inviteCode: String(row.invite_code),
    createdAt: String(row.created_at)
  }
}
