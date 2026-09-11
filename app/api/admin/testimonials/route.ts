// app/api/admin/testimonials/route.ts
// GET  /api/admin/testimonials -- list ALL testimonials incl. drafts, admin only
// POST /api/admin/testimonials -- create one, admin only
//
// consent is a z.literal(true) on create: a testimonial can only ever be
// inserted with consent on record. The separate `approved` switch controls
// publishing, and the public RLS policy requires both, so the API cannot
// accidentally publish an unconsented row even if a client sends approved.
//
// INPUT HARDENING: photo_url was z.string().url(), which accepts any host
// and javascript:/data: schemes. The photo is rendered in an <img> on the
// public landing page, so photo_url is now pinned to an https object in
// THIS project's own `site` storage bucket (isOwnStorageUrl) -- the only
// place the admin UI ever uploads it (testimonials/<id>.jpg).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { assertAdmin } from '@/lib/admin/guard'
import { isOwnStorageUrl } from '@/lib/validate'

const createSchema = z.object({
  quote: z.string().trim().min(10).max(300),
  full_name: z.string().trim().min(2).max(80),
  role: z.string().trim().min(2).max(120),
  photo_url: z
    .string()
    .refine(
      (v) => isOwnStorageUrl(v, 'site'),
      'photo_url must be an https URL in this project\'s site storage bucket'
    )
    .nullable()
    .optional(),
  consent: z.literal(true),
  approved: z.boolean().default(false),
  sort_order: z.number().int().default(0),
})

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-testimonials', limit: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response

  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ testimonials: data })
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-testimonials', limit: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response

  const raw = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid testimonial data', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { data, error } = await supabase.from('testimonials').insert(parsed.data).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ testimonial: data }, { status: 201 })
}
