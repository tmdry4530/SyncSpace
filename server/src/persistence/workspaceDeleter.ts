import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { ServerConfig } from '../config.js'
import { hasSupabaseAdminConfig } from '../config.js'
import type { Logger } from '../utils/logger.js'
import { createSupabaseAdminClient } from './supabaseAdmin.js'

export interface DeleteWorkspaceInput {
  workspaceId: string
  accessToken: string
}

export interface WorkspaceDeleter {
  deleteWorkspace(input: DeleteWorkspaceInput): Promise<string>
}

export class WorkspaceDeleteError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'WorkspaceDeleteError'
  }
}

export class DisabledWorkspaceDeleter implements WorkspaceDeleter {
  async deleteWorkspace(): Promise<string> {
    throw new WorkspaceDeleteError(503, 'workspace_delete_unavailable', '워크스페이스 삭제를 위한 서버 설정이 없습니다.')
  }
}

export class SupabaseWorkspaceDeleter implements WorkspaceDeleter {
  constructor(
    private readonly client: SupabaseClient,
    private readonly logger: Logger
  ) {}

  async deleteWorkspace(input: DeleteWorkspaceInput): Promise<string> {
    const workspaceId = input.workspaceId.trim()
    if (!isUuid(workspaceId)) {
      throw new WorkspaceDeleteError(400, 'invalid_workspace_id', '워크스페이스 경로가 올바르지 않습니다.')
    }

    const user = await this.authenticate(input.accessToken)

    const workspaceResult = await this.client
      .from('workspaces')
      .select('id,owner_id')
      .eq('id', workspaceId)
      .maybeSingle()

    if (workspaceResult.error) {
      this.logger.warn('Failed to look up workspace before delete', { workspaceId, userId: user.id, error: workspaceResult.error.message })
      throw new WorkspaceDeleteError(500, 'workspace_lookup_failed', '워크스페이스를 확인하지 못했습니다.')
    }

    if (!workspaceResult.data) {
      throw new WorkspaceDeleteError(404, 'workspace_not_found', '삭제할 워크스페이스를 찾지 못했습니다.')
    }

    if (String(workspaceResult.data.owner_id) !== user.id) {
      throw new WorkspaceDeleteError(403, 'workspace_delete_forbidden', '소유자만 워크스페이스를 삭제할 수 있습니다.')
    }

    const deleteResult = await this.client.from('workspaces').delete().eq('id', workspaceId)
    if (deleteResult.error) {
      this.logger.warn('Failed to delete workspace', { workspaceId, userId: user.id, error: deleteResult.error.message })
      throw new WorkspaceDeleteError(500, 'workspace_delete_failed', '워크스페이스를 삭제하지 못했습니다.')
    }

    return workspaceId
  }

  private async authenticate(accessToken: string): Promise<User> {
    if (!accessToken) {
      throw new WorkspaceDeleteError(401, 'missing_access_token', '로그인이 필요합니다.')
    }

    const result = await this.client.auth.getUser(accessToken)
    const user = result.data?.user
    if (result.error || !user) {
      throw new WorkspaceDeleteError(401, 'invalid_access_token', '로그인 세션이 유효하지 않습니다.')
    }
    return user
  }
}

export function createWorkspaceDeleter(config: ServerConfig, logger: Logger): WorkspaceDeleter {
  if (!hasSupabaseAdminConfig(config)) {
    logger.warn('Supabase service-role configuration is missing; workspace delete endpoint is disabled')
    return new DisabledWorkspaceDeleter()
  }

  return new SupabaseWorkspaceDeleter(createSupabaseAdminClient(config), logger)
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
