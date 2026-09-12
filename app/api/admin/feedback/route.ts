// app/api/admin/feedback/route.ts
// GET  /api/admin/feedback -- list feedback (open + resolved), admin only.
// PATCH /api/admin/feedback -- update status (open -> resolved -> open),
//      admin only. The update policy from migration 0021 is the real
//      enforcement; assertAdmin here is defense in depth and gives a
//      clean 403 before any DB work.
//
// ERROR HYGIENE: 500s go through dbErrorResponse so raw Postgres messages
// never reach the admin client.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { assertAdmin } from '@/lib/admin/guard'
import { dbErrorResponse } from '@/lib/errors'
import { ADMIN_LIST_CAP } from '@/lib/config'

const ROUTE = 'admin/feedback'

const updateSchema = z.object({
  status: z.enum(['open', 'resolved']),
})

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: ROUTE, limit: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response

  const { data: feedback, error } = await supabase
    .from('feedback')
    .select('id, profile_id, category, message, contact_email, page_url, status, resolved_at, created_at')
    .order('created_at', { ascending: false })
    .limit(ADMIN_LIST_CAP)

  if (error) return dbErrorResponse(ROUTE, error)

  return NextResponse.json({ feedback: feedback ?? [] })
}

export async function PATCH(request: Request) {
  const limited = await checkRateLimit(request, { route: ROUTE, limit: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response

  const raw = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success || typeof raw?.id !== 'string') {
    return NextResponse.json(
      { error: 'Invalid update. Send { id, status }.' },
      { status: 400 }
    )
  }

  const resolvedAt = parsed.data.status === 'resolved' ? new Date().toISOString() : null

  const { data, error } = await supabase
    .from('feedback')
    .update({ status: parsed.data.status, resolved_at: resolvedAt })
    .eq('id', raw.id)
    .select('id, status, resolved_at')
    .maybeSingle()

  if (error) return dbErrorResponse(ROUTE, error)
  if (!data) {
    return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
  }

  return NextResponse.json({ feedback: data })
}
