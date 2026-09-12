// app/api/admin/scholarships/[id]/route.ts
// PATCH  /api/admin/scholarships/[id] — partially update a scholarship, admin only
// DELETE /api/admin/scholarships/[id] — delete a scholarship (cascades to its
//        rules and any saved_scholarships/notifications rows via FK ON DELETE)
//
// PATCH rather than PUT: PUT implies replacing the whole resource, but
// admin edits here are typically "toggle verified" or "fix a deadline" —
// partial updates are the actual usage pattern.
//
// Phase 2: whenever an admin sets deadline, opens_at, or
// last_cycle_closed_at, an observed cycle_events row is recorded (deduped
// by scholarship + kind + date), so cycle history builds organically from
// real admin work instead of requiring a separate data-entry step. A
// cycle-log failure never fails the PATCH itself.
//
// Push C: re-saving a listing while verified refreshes last_verified_at,
// so the public "last checked" line means "last time a human confirmed
// this", not "first verified".
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { assertAdmin } from '@/lib/admin/guard'
import { decodeUnicodeEscapes } from '@/lib/text/unicode'
import { logError } from '@/lib/logging'
const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(300).transform(decodeUnicodeEscapes),
    provider_name: z.string().trim().min(1).max(300).transform(decodeUnicodeEscapes),
    description: z.string().trim().max(5000).transform(decodeUnicodeEscapes).nullable(),
    amount: z.string().trim().max(200).transform(decodeUnicodeEscapes).nullable(),
    deadline: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
    opens_at: z
      .string()
      .nullable()
      .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date'),
    last_cycle_closed_at: z
      .string()
      .nullable()
      .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date'),
    application_url: z.string().url().nullable(),
    how_to_apply: z.string().trim().max(2000).transform(decodeUnicodeEscapes).nullable(),
    level: z.enum(['undergrad', 'postgrad', 'both']),
    discipline: z.string().trim().max(200).nullable(),
    verified: z.boolean(),
    awards_available: z.number().int().positive().nullable(),
    estimated_applicant_pool: z.number().int().positive().nullable(),
    competitiveness_tier: z.enum(['low', 'medium', 'high', 'very_high']).nullable(),
    historical_acceptance_rate: z.number().min(0).max(1).nullable(),
    competitiveness_notes: z.string().trim().max(2000).nullable(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, 'No fields to update')
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await checkRateLimit(request, { route: 'admin-scholarships-id', limit: 60 })
  if (limited) return limited
  const { id } = await params
  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response
  const raw = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid update data', issues: parsed.error.issues },
      { status: 400 }
    )
  }
  // Push C: refreshing the verified stamp is a side effect of confirming
  // the listing is still live, not a field the admin edits by hand.
  const patch: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.verified === true) {
    patch.last_verified_at = new Date().toISOString()
  }
  const { data: scholarship, error } = await supabase
    .from('scholarships')
    .update(patch)
    .eq('id', id)
    .select('*, scholarship_rules ( id, field, operator, value )')
    .single()
  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Scholarship not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // Phase 2 cycle history: record observed window changes. Deduped so
  // re-saving the same date never doubles an event and skews prediction.
  try {
    const cycleWrites: { kind: 'opened' | 'closed' | 'deadline_set'; date: string }[] = [];
    if (parsed.data.opens_at) cycleWrites.push({ kind: 'opened', date: parsed.data.opens_at });
    if (parsed.data.last_cycle_closed_at) cycleWrites.push({ kind: 'closed', date: parsed.data.last_cycle_closed_at });
    if (parsed.data.deadline) cycleWrites.push({ kind: 'deadline_set', date: parsed.data.deadline });
    for (const w of cycleWrites) {
      const { data: existing } = await supabase
        .from('cycle_events')
        .select('id')
        .eq('scholarship_id', id)
        .eq('kind', w.kind)
        .eq('event_date', w.date)
        .limit(1);
      if ((existing ?? []).length === 0) {
        await supabase.from('cycle_events').insert({
          scholarship_id: id,
          kind: w.kind,
          event_date: w.date,
          captured_by: guard.userId,
          note: 'admin update',
        });
      }
    }
  } catch (err) {
    // Cycle logging is best-effort: never fail a successful scholarship
    // update because the history write failed.
    logError('admin/scholarships/[id]', 'cycle_event_write_failed', { scholarship: id }, err);
  }
  return NextResponse.json({ scholarship })
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await checkRateLimit(request, { route: 'admin-scholarships-id', limit: 60 })
  if (limited) return limited
  const { id } = await params
  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response
  const { error } = await supabase.from('scholarships').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ message: 'Scholarship deleted' })
}
