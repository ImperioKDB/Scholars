// SERVICE ROLE CLIENT — bypasses Row Level Security entirely.
// Use only for trusted system jobs that must operate across users' rows.
import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createTimeoutFetch } from '@/lib/fetch'

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars'
    )
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: { fetch: createTimeoutFetch() },
  })
}
