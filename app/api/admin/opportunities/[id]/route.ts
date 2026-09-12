// app/api/admin/opportunities/[id]/route.ts
// PATCH  /api/admin/opportunities/[id] -- partially update an opportunity, admin only
// DELETE /api/admin/opportunities/[id] -- delete an opportunity (cascades to
//        saved_opportunities/notifications rows via FK ON DELETE)
//
// Mirrors /api/admin/scholarships/[id].
//
// GUARD MIGRATION (Phase 0): local requireAdmin() copy removed in favour
// of assertAdmin() from lib/admin/guard.ts.
//
// INPUT HARDENING: application_url uses httpUrlSchema (http/https only),
// and the id path param is UUID-validated before any DB work.
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { assertAdmin } from '@/lib/admin/guard'
import { httpUrlSchema, isUuid } from '@/lib/validate'
const updateSchema = z
  .object({
    type: z.enum(['fellowship', 'internship', 'competition', 'mentorship']),
    title: z.string().trim().min(1).max(300),
    provider_name: z.string().trim().min(1).max(300),
    description: z.string().trim().max(5000).nullable(),
    eligibility_notes: z.string().trim().max(2000).nullable(),
    duration: z.string().trim().max(200).nullable(),
    location: z.string().trim().max(200).nullable(),
    compensation: z.string().trim().max(200).nullable(),
    discipline: z.string().trim().max(200).nullable(),
    deadline: z
      .string()
      .nullable()
      .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date'),
    opens_at: z
      .string()
      .nullable()
      .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date'),
    application_url: httpUrlSchema.nullable(),
    how_to_apply: z.string().trim().max(2000).nullable(),
    verified: z.boolean(),
    research_notes: z.string().trim().max(2000).nullable(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, 'No fields to update')
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await checkRateLimit(request, { route: 'admin-opportunities-id', limit: 60 })
  if (limited) return limited
  const { id } = await params
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }
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
  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .update(parsed.data)
    .eq('id', id)
    .select('*')
    .single()
  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // SHARE PAGES: this PATCH flips `verified` (unverify hides the /o/[id]
  // page), so drop the ISR cache for this path too.
  revalidatePath('/o/[id]')
  return NextResponse.json({ opportunity })
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await checkRateLimit(request, { route: 'admin-opportunities-id', limit: 60 })
  if (limited) return limited
  const { id } = await params
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }
  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response
  const { error } = await supabase.from('opportunities').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  revalidatePath('/o/[id]')
  return NextResponse.json({ message: 'Opportunity deleted' })
}
