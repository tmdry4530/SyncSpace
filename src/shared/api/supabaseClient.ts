import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { missingSupabaseConfigError } from './errors'
import { readClientEnv } from '../types/env'

let cachedClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  const env = readClientEnv()
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null
  cachedClient ??= createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })
  return cachedClient
}

export function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient()
  if (!client) throw missingSupabaseConfigError()
  return client
}
