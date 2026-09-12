// app/api/events/route.ts
// POST /api/events { event, meta? }
//
// Client product-analytics intake (Phase 1). The enum here is the first
// gate; the events_event_whitelist check constraint (migration 0019) is
// the backstop. profile_created / profile_completed are NOT accepted here
// on purpose: they are written server-side by POST /api/profile, where the
// before/after profile state is actually known.
//
// Rate limited 60/min per user: analytics bursts on mount are normal, but
// 60/min sits far above honest usage and far below a script.
//
// meta is capped (10 keys, 200-char strings) so this endpoint can never be
// used as an unbounded storage sink.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
const CLIENT_EVENTS = [
  'provisional_matches_viewed',
  'gap_nudge_clicked',
  'whatsapp_opt_in',
  'whatsapp_opt_out',
] as const
const metaSchema = z
  .record(z.union([z.string().max(200), z.number(), z.boolean()]))
  .refine((m) => Object.keys(m).length <= 10, 'Too many meta keys')
const bodySchema = z.object({
  event: z.enum(CLIENT_EVENTS),
  meta: metaSchema.optional(),
})
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
    route: 'events',
    limit: 60,
    extraKeys: [`user:${user.id}`],
  })
  if (limited) return limited
  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const { error } = await supabase.from('events').insert({
    profile_id: user.id,
    event: parsed.data.event,
    meta: parsed.data.meta ?? {},
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}
