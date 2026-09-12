// app/api/heartbeat/route.ts
// POST /api/heartbeat
//
// Lightweight presence signal. The Sidebar fires this every ~60 seconds
// while the app is open (plus once on mount and on visibility change).
// Updates the caller's own profiles.last_seen_at, which /admin/users
// buckets into Active / Idle / Offline.
//
// Rate limited to 2 req/min per IP -- honest clients fire once a minute,
// so this cap is well above real usage and still brakes a script trying
// to spam the endpoint. The update is fire-and-forget from the client's
// point of view: a failure here just means one missed tick, the next one
// will still land.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: 'heartbeat', limit: 2 })
  if (limited) return limited

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
