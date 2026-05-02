import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { ServerConfig } from '../config.js'
import { hasSupabaseAdminConfig } from '../config.js'
import type { Workspace } from '../types/contracts.js'
import type { Logger } from '../utils/logger.js'
import { createSupabaseAdminClient } from './supabaseAdmin.js'

export interface JoinWorkspaceInput {
  inviteCode: string
  accessToken: string
}

export interface WorkspaceJoiner {
  joinByInviteCode(input: JoinWorkspaceInput): Promise<Workspace>
}

export class WorkspaceJoinError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'WorkspaceJoinError'
  }
}

export class DisabledWorkspaceJoiner implements WorkspaceJoiner {
  async joinByInviteCode(): Promise<Workspace> {
    throw new WorkspaceJoinError(503, 'workspace_join_unavailable', '워크스페이스 초대 참여를 위한 서버 설정이 없습니다.')
  }
}

export class SupabaseWorkspaceJoiner implements WorkspaceJoiner {
  constructor(
    private readonly client: SupabaseClient,
    private readonly logger: Logger
  ) {}

  async joinByInviteCode(input: JoinWorkspaceInput): Promise<Workspace> {
    const inviteCode = normalizeInviteCode(input.inviteCode)
    if (!inviteCode) {
      throw new WorkspaceJoinError(400, 'invalid_invite_code', '초대 코드를 입력해주세요.')
    }

    const user = await this.authenticate(input.accessToken)
    await this.ensureProfile(user)

    const workspaceResult = await this.client
      .from('workspaces')
      .select('id,name,owner_id,invite_code,created_at')
      .eq('invite_code', inviteCode)
      .maybeSingle()

    if (workspaceResult.error) {
      this.logger.warn('Failed to look up workspace invite code', { inviteCode, error: workspaceResult.error.message })
      throw new WorkspaceJoinError(500, 'workspace_lookup_failed', '워크스페이스 초대 코드를 확인하지 못했습니다.')
    }

    if (!workspaceResult.data) {
      throw new WorkspaceJoinError(404, 'workspace_invite_not_found', '일치하는 워크스페이스 초대 코드가 없습니다.')
    }

    const membershipResult = await this.client.from('workspace_members').upsert(
      {
        workspace_id: workspaceResult.data.id,
        user_id: user.id,
        role: 'member'
      },
      { onConflict: 'workspace_id,user_id', ignoreDuplicates: true }
    )

    if (membershipResult.error) {
      this.logger.warn('Failed to join workspace by invite code', {
        workspaceId: workspaceResult.data.id,
        userId: user.id,
        error: membershipResult.error.message
      })
      throw new WorkspaceJoinError(500, 'workspace_join_failed', '워크스페이스에 참여하지 못했습니다.')
    }

    return mapWorkspaceRow(workspaceResult.data)
  }

  private async authenticate(accessToken: string): Promise<User> {
    if (!accessToken) {
      throw new WorkspaceJoinError(401, 'missing_access_token', '로그인이 필요합니다.')
    }

    const result = await this.client.auth.getUser(accessToken)
    const user = result.data?.user
    if (result.error || !user) {
      throw new WorkspaceJoinError(401, 'invalid_access_token', '로그인 세션이 유효하지 않습니다.')
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
      this.logger.warn('Failed to ensure profile before workspace join', { userId: user.id, error: result.error.message })
      throw new WorkspaceJoinError(500, 'profile_sync_failed', '사용자 프로필을 준비하지 못했습니다.')
    }
  }
}

export function createWorkspaceJoiner(config: ServerConfig, logger: Logger): WorkspaceJoiner {
  if (!hasSupabaseAdminConfig(config)) {
    logger.warn('Supabase service-role configuration is missing; workspace invite join endpoint is disabled')
    return new DisabledWorkspaceJoiner()
  }

  return new SupabaseWorkspaceJoiner(createSupabaseAdminClient(config), logger)
}

export function normalizeInviteCode(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase()
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
