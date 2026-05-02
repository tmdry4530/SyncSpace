import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '../..')
const schemaSql = readFileSync(resolve(repoRoot, 'supabase/schema.sql'), 'utf8')
const rlsSql = readFileSync(resolve(repoRoot, 'supabase/rls.sql'), 'utf8')
const seedSql = readFileSync(resolve(repoRoot, 'supabase/seed.sql'), 'utf8')

describe('Supabase SQL contract', () => {
  const coreTables = ['profiles', 'workspaces', 'workspace_members', 'channels', 'documents', 'messages']

  it('defines all contract core tables', () => {
    for (const table of coreTables) {
      expect(schemaSql).toContain(`create table if not exists public.${table}`)
    }
  })

  it('enables RLS on all core tables', () => {
    for (const table of coreTables) {
      expect(rlsSql).toContain(`alter table public.${table} enable row level security;`)
    }
  })

  it('keeps workspace-scoped data behind membership helpers', () => {
    expect(schemaSql).toContain('public.is_workspace_member')
    expect(schemaSql).toContain('public.can_access_channel')
    expect(rlsSql).toContain('public.is_workspace_member(workspace_id)')
    expect(rlsSql).toContain('public.can_access_channel(channel_id)')
  })

  it('bootstraps owner membership when a workspace is created', () => {
    expect(schemaSql).toContain('public.add_workspace_owner_member')
    expect(schemaSql).toContain('create trigger workspaces_add_owner_member')
  })

  it('seeds deterministic local development data without service-role secrets', () => {
    expect(seedSql).toContain('ada@syncspace.dev')
    expect(seedSql).toContain('grace@syncspace.dev')
    expect(seedSql).not.toMatch(/service[_-]?role/i)
  })
})
