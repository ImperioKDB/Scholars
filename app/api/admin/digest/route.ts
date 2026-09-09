// app/api/admin/digest/route.ts
// POST /api/admin/digest -- manual trigger for the new-listing digest.
//
// Admin-only: the middleware /api/admin gate plus assertAdmin here, same
// defense in depth as every other admin route. Rate limited 5/min so a
// stuck button cannot fan out sends.
//
// Passes minIntervalMs: 0 on purpose. An admin pressing this just added
// listings and wants them out now; the 2-hour re-blast throttle (which the
// cron uses) would make the button a no-op right after a scheduled run.
// Listing-level dedupe via announcement_log still guarantees each student
// receives each listing exactly once, so pressing twice the same day only
// sends listings added since the first press.
//
// maxDuration 300 so a large student base is not cut off mid-send by the
// default function timeout.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '@/lib/admin/guard'
import { checkRateLimit } from '@/lib/ratelimit'
import { runNewListingDigest } from '@/lib/email/digest'

export const maxDuration = 300

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-digest', limit: 5 })
  if (limited) return limited
  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response
  const summary = await runNewListingDigest({ minIntervalMs: 0 })
  return NextResponse.json({ summary })
}
