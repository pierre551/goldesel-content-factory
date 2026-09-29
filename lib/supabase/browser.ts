import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser Supabase client using the public anon key. Used ONLY to push an
 * already-authorized signed upload (uploadToSignedUrl) straight to Storage, so
 * large reel source videos never transit a serverless route (spec §26). The
 * upload is authorized by a short-lived token minted server-side; the anon key
 * alone grants no write access because the media bucket has no public policies.
 */
let cached: SupabaseClient | null = null

export function getBrowserSupabase(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Supabase Public-Credentials fehlen.')
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
