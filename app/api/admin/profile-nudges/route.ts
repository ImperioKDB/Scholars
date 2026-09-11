// app/api/admin/profile-nudges/route.ts
// POST /api/admin/profile-nudges -- the admin profile-reminder buttons.
//   body {}              routine pass: same 2-day interval as the cron, so
//                        pressing twice in one day sends nothing new the
//                        second time; the 5-email cap holds.
//   body { force: true } override pass: ignores the 2-day wait AND the
//                        5-email cap, emailing every profile under 100%
//                        right now (batch-capped at
//                        PROFILE_NUDGE_FORCE_BATCH per press). For one-off
//                        campaigns; the confirm dialog in the admin UI
//                        states exactly what it overrides.
//
// Auth: the middleware /api/admin gate plus assertAdmin here, the same
// defense in depth as the other admin routes. Rate limited 5/min so a
// stuck button cannot fan out sends. maxDuration 300 so a large student
// base is not cut off mid-send.
//
// Both paths write the same ledger columns (migration 0018), so an
// override press today keeps the GitHub Actions cron quiet for the next
// 2 days, and a recent cron pass is exactly what the override ignores.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '@/lib/admin/guard'
import { checkRateLimit } from '@/lib/ratelimit'
import { runProfileNudges, PROFILE_NUDGE_INTERVAL_MS } from '@/lib/email/profileNudges'
export const maxDuration = 300
const bodySchema = z.object({ force: z.boolean().optional().default(false) })
export async function POST(request: Request) {
const limited = await checkRateLimit(request, { route: 'admin-profile-nudges', limit: 5 })
if (limited) return limited
const supabase = await createClient()
const guard = await assertAdmin(supabase)
if (!guard.ok) return guard.response
const raw = await request.json().catch(() => null)
const parsed = bodySchema.safeParse(raw ?? {})
if (!parsed.success) {
return NextResponse.json(
{ error: 'Invalid request body', issues: parsed.error.issues },
{ status: 400 }
)
}
const force = parsed.data.force
const summary = await runProfileNudges(
force
? { minIntervalMs: 0, enforceSendWindow: false, ignoreCap: true }
: { minIntervalMs: PROFILE_NUDGE_INTERVAL_MS, enforceSendWindow: false }
)
return NextResponse.json({ summary: { ...summary, forced: force } })
}
