// app/api/admin/digest/route.ts
// POST /api/admin/digest -- the admin "send the digest now" button.
//
// Auth: the middleware /api/admin gate plus an inline is_admin check here,
// the same defense in depth as the other admin routes. No cron secret
// involved: this rides on your logged-in admin session.
//
// Rate limited to 5 calls per minute so a stuck button cannot fan out
// sends. maxDuration 300 so a large student base is not cut off mid-send.
//
// Passes minIntervalMs: 0 on purpose. Listing-level dedupe in
// announcement_log still guarantees each student receives each listing
// exactly once, so a second press the same day only sends listings
// verified since the first press.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { runNewListingDigest } from '@/lib/email/digest'

export const maxDuration = 300

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-digest', limit: 5 })
  if (limited) return limited
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  const summary = await runNewListingDigest({ minIntervalMs: 0 })
  return NextResponse.json({ summary })
}
