// lib/supabase/server.ts
// Server-side Supabase client, scoped to the requesting user's session via
// cookies. Uses the anon key + the user's JWT, so RLS policies apply —
// this is the client to use for anything the user should only see/touch
// their own rows of (profile, saved_scholarships, notifications, and
// read-only access to verified scholarships).
//
// Do NOT use this for admin write routes — those need the service role
// key, created separately in a server-only helper that is never imported
// into anything reachable from the client bundle.

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Called from a Server Component context where cookies can't
            // be set — safe to ignore if middleware refreshes sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Same as above.
          }
        },
      },
    }
  )
}
