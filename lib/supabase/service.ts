// lib/supabase/service.ts
//
// SERVICE ROLE CLIENT — bypasses Row Level Security entirely.
//
// Use ONLY for:
//   - The deadline-reminder cron job (writes notifications for arbitrary
//     users; there's no user session to scope an RLS-respecting client to)
//   - Any future system job that must act across all users' rows
//
// NEVER import this into anything reachable from a page, a client
// component, or a normal user-triggered API route. Every route that
// imports this file should independently verify it's only reachable by
// a trusted caller (e.g. the CRON_SECRET check in the cron route) —
// this client has no other access control of its own.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

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
  })
}
