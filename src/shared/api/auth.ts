import type { SupabaseClient, User } from '@supabase/supabase-js'

export async function getAuthenticatedUser(client: SupabaseClient): Promise<User> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('로그인이 필요합니다.')
  return data.user
}

export async function getCurrentAccessToken(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getSession()
  return data.session?.access_token ?? null
}
