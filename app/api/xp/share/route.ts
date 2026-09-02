// app/api/xp/share/route.ts
// POST /api/xp/share { scholarship_id }
//
// Awards the small, deliberately cheap "share_click" XP (3 points) the
// moment a signed-in student uses ShareButton. This is NOT the referral
// reward -- that's the much larger, server-verified referral_confirmed
// award (50 points), which only fires via a Postgres trigger
// (check_referral_completion, migration add_xp_and_achievements) when
// someone the sharer referred actually completes onboarding. This route
// rewards the act of sharing itself, at a value low enough that spamming
// the endpoint earns nothing worth the effort.
//
// Dedupe key is profile + scholarship + day, not just profile +
// scholarship -- sharing the same scholarship again tomorrow is still
// worth something, but hammering the button in a loop right now earns
// nothing past the first call today.
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

const bodySchema = z.object({
  scholarship_id: z.string().uuid(),
})

const SHARE_CLICK_POINTS = 3

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const dedupeKey = 'share_click:' + parsed.data.scholarship_id + ':' + today

  const service = createServiceClient()
  const { error } = await service.rpc('award_xp', {
    p_profile_id: user.id,
    p_event_type: 'share_click',
    p_points: SHARE_CLICK_POINTS,
    p_dedupe_key: dedupeKey,
    p_metadata: { scholarship_id: parsed.data.scholarship_id },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ awarded: true, points: SHARE_CLICK_POINTS })
}
