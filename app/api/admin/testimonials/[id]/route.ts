// app/api/admin/testimonials/[id]/route.ts
// PATCH  /api/admin/testimonials/[id] -- update fields incl. approve toggle
// DELETE /api/admin/testimonials/[id] -- delete the row (photo object is
//        removed by the admin UI, which owns the Storage call)
//
// Publishing guard: approving requires consent on record (either already
// stored or set true in this same patch). The public RLS policy is the
// backstop, but refusing here keeps the admin UI from showing a publish
// toggle that silently does nothing.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { assertAdmin } from '@/lib/admin/guard'

const updateSchema = z
  .object({
    quote: z.string().trim().min(10).max(300).optional(),
    full_name: z.string().trim().min(2).max(80).optional(),
    role: z.string().trim().min(2).max(120).optional(),
    photo_url: z.string().url().nullable().optional(),
    consent: z.boolean().optional(),
    approved: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, 'No fields to update')

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await checkRateLimit(request, { route: 'admin-testimonials-id', limit: 60 })
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
  if (parsed.data.approved === true) {
    const { data: row } = await supabase
      .from('testimonials')
      .select('consent')
      .eq('id', id)
      .maybeSingle()
    const consentAfter = parsed.data.consent ?? (row?.consent as boolean | undefined)
    if (!consentAfter) {
      return NextResponse.json(
        { error: 'Cannot publish a testimonial without consent on record.' },
        { status: 400 }
      )
    }
  }
  const { data, error } = await supabase
    .from('testimonials')
    .update(parsed.data)
    .eq('id', id)
    .select('*')
    .single()
  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ testimonial: data })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await checkRateLimit(request, { route: 'admin-testimonials-id', limit: 60 })
  if (limited) return limited
  const { id } = await params
  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response
  const { error, count } = await supabase.from('testimonials').delete({ count: 'exact' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 })
  return NextResponse.json({ message: 'Testimonial deleted' })
}
