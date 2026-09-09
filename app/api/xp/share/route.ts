// app/api/xp/share/route.ts
// POST /api/xp/share { scholarship_id? , opportunity_id? }
//
// Awards the small, deliberately cheap share XP (3 points) when a signed-in
// student uses ShareButton -- for scholarships AND opportunities
// (fellowships, internships, competitions, mentorships). This is NOT the
// referral reward -- that's the much larger, server-verified
// referral_confirmed award (50 points), which only fires via a Postgres
// trigger (check_referral_completion, migration add_xp_and_achievements)
// when someone the sharer referred actually completes onboarding. This
// route rewards the act of sharing itself, at a value low enough that
// spamming the endpoint earns nothing worth the effort.
//
// Dedupe key is profile + entity + day, not just profile + entity --
// sharing the same listing again tomorrow is still worth something, but
// hammering the button in a loop right now earns nothing past the first
// call today. Scholarship and opportunity shares dedupe SEPARATELY (sharing
// a competition you already shared a scholarship of still counts), but both
// draw from the SAME per-profile daily cap below.
//
// AUDIT FIX (batch 5): the dedupe above only stopped repeat-shares of ONE
// listing -- a script walking every id could still farm 3 points per row.
// There's a hard per-profile daily cap on total share awards, checked
// against xp_events before awarding. Checked via the service client because
// xp_events writes go through the service role (same reason award_xp runs
// through it); migration 0011's select-own policy means the count could
// also read through the RLS client, but service-role keeps the farming
// check on the same privileged path as the award. Capped requests return
// success-with-nothing rather than an error -- no reason to advertise the
// cap to a scraper.
//
// SECURITY HARDENING (phase 1): an IP bucket AND a per-user bucket
// (20/min each) so neither a scripted IP nor a compromised session can
// hammer this endpoint. Placed after auth because the user bucket needs
// the uid.
//
// Uses the service-role client deliberately: award_xp() has EXECUTE
// revoked from the authenticated Postgres role specifically so a client
// can never call it directly (e.g. via supabase.rpc() from devtools with
// a fabricated point value). This route is the one narrow, server-
// controlled path allowed to award it, with the point value hardcoded
// here -- never accepted from the request body.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/ratelimit'

// Exactly one entity id required; which field determines the kind.
// Scholarship stays the default so existing ScholarshipCard calls
// (scholarship_id only) keep working unchanged.
const bodySchema = z
  .object({
    scholarship_id: z.string().uuid().optional(),
    opportunity_id: z.string().uuid().optional(),
  })
  .refine((b) => Boolean(b.scholarship_id) !== Boolean(b.opportunity_id), {
    message: 'Provide exactly one of scholarship_id or opportunity_id',
  })

const SHARE_POINTS = 3
const MAX_SHARES_PER_DAY = 10

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const limited = await checkRateLimit(request, {
    route: 'xp-share',
    limit: 20,
    extraKeys: [`user:${user.id}`],
  })
  if (limited) return limited

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const isOpportunity = Boolean(parsed.data.opportunity_id)
  const entityId = isOpportunity ? parsed.data.opportunity_id! : parsed.data.scholarship_id!
  // 'opportunity_share' needs migration 0017 (xp_event_type enum value) --
  // apply it before deploying this route.
  const eventType = isOpportunity ? 'opportunity_share' : 'share_click'

  const today = new Date().toISOString().slice(0, 10)
  const dedupeKey = `${eventType}:${entityId}:${today}`
  const service = createServiceClient()

  // Per-profile daily cap. dedupe_key always ends with ":<YYYY-MM-DD>"
  // for share events, so suffix-matching counts today's awards without
  // depending on columns beyond the ones award_xp already guarantees
  // exist (profile_id, event_type, dedupe_key). One cap across BOTH
  // kinds on purpose -- the cap limits farming, not honest sharing.
  const { count: awardedToday, error: countError } = await service
    .from('xp_events')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', user.id)
    .in('event_type', ['share_click', 'opportunity_share'])
    .like('dedupe_key', `%:${today}`)
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }
  if ((awardedToday ?? 0) >= MAX_SHARES_PER_DAY) {
    return NextResponse.json({ awarded: false, points: 0 })
  }

  const { error } = await service.rpc('award_xp', {
    p_profile_id: user.id,
    p_event_type: eventType,
    p_points: SHARE_POINTS,
    p_dedupe_key: dedupeKey,
    p_metadata: isOpportunity ? { opportunity_id: entityId } : { scholarship_id: entityId },
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ awarded: true, points: SHARE_POINTS })
}
