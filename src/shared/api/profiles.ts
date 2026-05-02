import type { User } from '@supabase/supabase-js'
import { requireSupabaseClient } from './supabaseClient'
import type { UserProfile } from '../types/contracts'

const FALLBACK_COLORS = ['#7c3aed', '#0891b2', '#dc2626', '#16a34a', '#ea580c', '#2563eb']
const PROFILE_COLUMNS = 'id,display_name,avatar_url,color'

type ProfileRow = {
  id: string
  display_name: string
  avatar_url: string | null
  color: string
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const existing = await getUserProfile(user.id)
  if (existing) return existing

  const draft = createProfileDraft(user)
  const supabase = requireSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: draft.id,
        display_name: draft.displayName,
        avatar_url: draft.avatarUrl,
        color: draft.color
      },
      { onConflict: 'id' }
    )
    .select(PROFILE_COLUMNS)
    .single()

  if (error) throw error
  return mapProfile(data)
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = requireSupabaseClient()
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle()
  if (error) throw error
  return data ? mapProfile(data) : null
}

export function createProfileDraft(user: User): UserProfile {
  const metadata = user.user_metadata as Record<string, unknown>
  const displayName = pickString(metadata.displayName) ?? pickString(metadata.name) ?? user.email?.split('@')[0] ?? 'SyncSpace User'
  const avatarUrl = pickString(metadata.avatarUrl) ?? pickString(metadata.avatar_url) ?? null
  const color = pickString(metadata.color) ?? stableColor(user.id)

  return {
    id: user.id,
    displayName,
    avatarUrl,
    color
  }
}

export function mapProfile(row: ProfileRow | Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    displayName: String(row.display_name),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    color: String(row.color)
  }
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function stableColor(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length] ?? '#64748b'
}
