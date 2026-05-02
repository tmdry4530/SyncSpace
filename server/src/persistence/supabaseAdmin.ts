import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasSupabaseAdminConfig, type ServerConfig } from '../config.js'

export function createSupabaseAdminClient(config: ServerConfig): SupabaseClient {
  if (!hasSupabaseAdminConfig(config) || !config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error('Supabase admin client requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}
