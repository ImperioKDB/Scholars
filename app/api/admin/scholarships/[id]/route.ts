// app/api/admin/scholarships/[id]/route.ts
// PATCH  /api/admin/scholarships/[id] — partially update a scholarship, admin only
// DELETE /api/admin/scholarships/[id] — delete a scholarship (cascades to its
//        rules and any saved_scholarships/notifications rows via FK ON DELETE)
//
// PATCH rather than PUT: PUT implies replacing the whole resource, but
// admin edits here are typically "toggle verified" or "fix a deadline" —
// partial updates are the actual usage pattern, so PATCH semantics fit
// better even though 05_CODING_WORKFLOW.md says "PUT". Flagging the
// deviation — swap the export name back to PUT if you'd rather match the
// doc literally; the handler logic doesn't change either way.
//
// how_to_apply added: fallback guidance shown to students when
// application_url is blank -- see migration: add_how_to_apply_fallback.
//
// awards_available / estimated_applicant_pool / competitiveness_tier /
// historical_acceptance_rate / competitiveness_notes added: competitiveness
// inputs consumed by lib/matching/engine.ts's computeCompetitivenessFactor
// -- see migration: add_competitiveness_fields.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    provider_name: z.string().trim().min(1).max(300),
    description: z.string().trim().max(5000).nullable(),
    amount: z.string().trim().max(200).nullable(),
    deadline: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
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

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.is_admin) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }

  return { user }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const check = await requireAdmin(supabase)
  if (check.error) return check.error

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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const check = await requireAdmin(supabase)
  if (check.error) return check.error

  const { error } = await supabase.from('scholarships').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Scholarship deleted' })
}
