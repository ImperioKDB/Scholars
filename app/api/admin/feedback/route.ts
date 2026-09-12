// app/api/admin/feedback/route.ts
// GET   /api/admin/feedback - list student feedback newest-first, admin only.
// PATCH /api/admin/feedback - flip a feedback row open <-> resolved.
//
// The student-facing intake (app/api/feedback/route.ts) already emails the
// support mailbox; this is the in-app inbox so feedback can be worked and
// closed without living only in Gmail. Resolve, don't delete: feedback is
// a record, and migration 0021 deliberately adds no delete policy.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { assertAdmin } from '@/lib/admin/guard'
import { dbErrorResponse } from '@/lib/errors'
const ROUTE = 'admin/feedback'
const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['open', 'resolved']),
})
export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: ROUTE, limit: 60 })
  if (limited) return limited
  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response
  const { data, error } = await supabase
    .from('feedback')
    .select('id, category, message, contact_email, page_url, created_at, status, resolved_at, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return dbErrorResponse(ROUTE, error)
  return NextResponse.json({ feedback: data ?? [] })
}
export async function PATCH(request: Request) {
  const limited = await checkRateLimit(request, { route: ROUTE, limit: 60 })
  if (limited) return limited
  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response
  const raw = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const resolved = parsed.data.status === 'resolved'
  const { data, error } = await supabase
    .from('feedback')
    .update({ status: parsed.data.status, resolved_at: resolved ? new Date().toISOString() : null })
    .eq('id', parsed.data.id)
    .select('id, status, resolved_at')
    .single()
  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }
    return dbErrorResponse(ROUTE, error)
  }
  return NextResponse.json({ feedback: data })
}
