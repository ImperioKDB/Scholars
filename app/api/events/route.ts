// app/api/events/route.ts
// POST /api/events { event, meta? }
//
// Product events require authentication. The exception is page_viewed: it is
// also accepted anonymously so admin visitor counts include public traffic.
// Anonymous traffic is represented by a long-lived opaque cookie and a
// day-level aggregate; no IP address, user agent, or page history is stored.
import { dbErrorResponse } from '@/lib/errors'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/ratelimit'

const VISITOR_COOKIE = 'scholars_visitor_id'
const CLIENT_EVENTS = [
  'page_viewed', 'web_vital', 'client_error', 'button_clicked',
  'weekly_focus_viewed', 'weekly_focus_actioned', 'onboarding_step_completed',
  'onboarding_abandoned', 'scholarship_issue_reported', 'outcome_recorded',
  'onboarding_step_viewed', 'provisional_matches_viewed', 'match_viewed',
  'scholarship_saved', 'application_started', 'provider_clicked',
  'application_status_changed', 'draft_generated', 'draft_confirmed',
  'gap_nudge_clicked', 'whatsapp_opt_in', 'whatsapp_opt_out',
  'community_post_created', 'community_reply_created',
  'community_helpful_reaction', 'community_reported',
] as const
const metaSchema = z
  .record(z.union([z.string().max(200), z.number(), z.boolean()]))
  .refine((m) => Object.keys(m).length <= 10, 'Too many meta keys')
const bodySchema = z.object({ event: z.enum(CLIENT_EVENTS), meta: metaSchema.optional() })

function visitorCookieValue(request: Request): { value: string; isNew: boolean } {
  const existing = (request.headers.get('cookie') ?? '')
    .split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE}=`))
    ?.slice(VISITOR_COOKIE.length + 1)
  if (existing && /^[A-Za-z0-9_-]{16,128}$/.test(existing)) return { value: existing, isNew: false }
  return { value: crypto.randomUUID().replaceAll('-', ''), isNew: true }
}

function withVisitorCookie(response: NextResponse, value: string, isNew: boolean) {
  if (isNew) response.cookies.set({
    name: VISITOR_COOKIE, value, httpOnly: true, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365, path: '/',
  })
  return response
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user && parsed.data.event !== 'page_viewed') return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const limited = await checkRateLimit(request, {
    route: 'events', limit: user ? 60 : 30,
    ...(user ? { extraKeys: [`user:${user.id}`] } : {}),
  })
  if (limited) return limited

  if (parsed.data.event === 'page_viewed') {
    const visitor = visitorCookieValue(request)
    try {
      const service = createServiceClient()
      await service.rpc('record_visitor_page_view', {
        p_visitor_key: user ? `profile:${user.id}` : `cookie:${visitor.value}`,
        p_seen_at: new Date().toISOString(),
      })
    } catch {
      // Visitor monitoring must never block navigation or surface an error.
    }
    return withVisitorCookie(NextResponse.json({ ok: true }, { status: 201 }), visitor.value, visitor.isNew)
  }

  const { error } = await supabase.from('events').insert({
    profile_id: user!.id, event: parsed.data.event, meta: parsed.data.meta ?? {},
  })
  if (error) return dbErrorResponse('events', error)
  return NextResponse.json({ ok: true }, { status: 201 })
}
