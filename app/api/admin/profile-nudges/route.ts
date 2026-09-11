// app/api/admin/profile-nudges/route.ts
// POST /api/admin/profile-nudges -- the admin "send profile reminders now"
// button (components/admin/SendProfileNudgesButton.tsx).
//
// Auth: the middleware /api/admin gate plus assertAdmin here, the same
// defense in depth as the other admin routes. Rate limited 5/min so a
// stuck button can't fan out sends. maxDuration 300 so a large student
// base isn't cut off mid-send.
//
// Runs the SAME shared logic as the cron's Phase 1b
// (lib/email/profileNudges.ts) with the SAME 2-day interval -- so pressing
// the button twice in one day sends nothing new on the second press
// (everyone reminded by the first press is inside the interval). The
// 5-email-per-student cap holds across cron + button combined, since both
// write the same ledger columns from migration 0018.
//
// One deliberate difference from the cron: no Lagos daytime window. This
// is an explicit human action, so the admin owns the timing decision --
// the interval and the cap stay as the anti-spam backstop.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '@/lib/admin/guard'
import { checkRateLimit } from '@/lib/ratelimit'
import { runProfileNudges, PROFILE_NUDGE_INTERVAL_MS } from '@/lib/email/profileNudges'
export const maxDuration = 300
export async function POST(request: Request) {
const limited = await checkRateLimit(request, { route: 'admin-profile-nudges', limit: 5 })
if (limited) return limited
const supabase = await createClient()
const guard = await assertAdmin(supabase)
if (!guard.ok) return guard.response
const summary = await runProfileNudges({
minIntervalMs: PROFILE_NUDGE_INTERVAL_MS,
enforceSendWindow: false,
})
return NextResponse.json({ summary })
}
