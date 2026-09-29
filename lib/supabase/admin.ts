import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service-role (secret) key.
 * This app has no end-user auth; the factory workflow runs as a trusted
 * backend actor, so it bypasses RLS. NEVER import this from client code.
 */
let cached: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase server credentials missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY).',
    )
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
