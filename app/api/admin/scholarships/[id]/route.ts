// app/api/admin/scholarships/[id]/route.ts
// PATCH  /api/admin/scholarships/[id] — partially update a scholarship, admin only
// DELETE /api/admin/scholarships/[id] — delete a scholarship (cascades to its
//        rules and any saved_scholarships/notifications rows via FK ON DELETE)
//
// PATCH rather than PUT: PUT implies replacing the whole resource, but
// admin edits here are typically "toggle verified" or "fix a deadline" —
// partial updates are the actual usage pattern.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { assertAdmin } from '@/lib/admin/guard'

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    provider_name: z.string().trim().min(1).max(300),
    description: z.string().trim().max(5000).nullable(),
    amount: z.string().trim().max(200).nullable(),
    deadline: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
    opens_at: z
      .string()
      .nullable()
      .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date'),
    application_url: z.string().url().nullable(),
    how_to_apply: z.string().trim().max(2000).nullable(),
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
  const { data: scholarship, error } = await supabase
    .from('scholarships')
    .update(parsed.data)
    .eq('id', id)
    .select('*, scholarship_rules ( id, field, operator, value )')
    .single()
  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Scholarship not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
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
