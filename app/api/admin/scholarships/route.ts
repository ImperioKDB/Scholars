// app/api/admin/scholarships/route.ts
// GET  /api/admin/scholarships - list scholarships (verified + unverified), admin only.
// POST /api/admin/scholarships - create a scholarship, optionally with
//      inline eligibility rules, admin only.
//
// Defense in depth: RLS already restricts writes to is_admin(auth.uid()),
// but we also check profile.is_admin server-side (via lib/admin/guard.ts)
// before attempting the mutation, so a non-admin gets a clear 403 instead
// of a confusing RLS failure buried in a Postgres error. The middleware
// /api/admin gate is a third, independent enforcement point.
//
// INPUT HARDENING: application_url uses httpUrlSchema (http/https only),
// because z.string().url() accepts javascript:/data: URLs and this value
// is opened via window.open in the student UI.
//
// ERROR HYGIENE: 500s go through dbErrorResponse so raw Postgres messages
// never reach the admin client.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { assertAdmin } from '@/lib/admin/guard'
import { httpUrlSchema } from '@/lib/validate'
import { decodeUnicodeEscapes } from '@/lib/text/unicode'
import { ADMIN_LIST_CAP } from '@/lib/config'
import { dbErrorResponse } from '@/lib/errors'

const ROUTE = 'admin/scholarships'

const ruleSchema = z.object({
  field: z.enum(['gpa', 'nationality', 'gender', 'financial_need', 'academic_level', 'discipline', 'career_goals']),
  operator: z.enum(['eq', 'gte', 'lte', 'in', 'exists']),
  value: z.unknown(),
})

const scholarshipSchema = z.object({
  title: z.string().trim().min(1).max(300).transform(decodeUnicodeEscapes),
  provider_name: z.string().trim().min(1).max(300).transform(decodeUnicodeEscapes),
  description: z.string().trim().max(5000).transform(decodeUnicodeEscapes).nullable().optional(),
  amount: z.string().trim().max(200).transform(decodeUnicodeEscapes).nullable().optional(),
  deadline: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
  opens_at: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date'),
  application_url: httpUrlSchema.nullable().optional(),
  how_to_apply: z.string().trim().max(2000).transform(decodeUnicodeEscapes).nullable().optional(),
  level: z.enum(['undergrad', 'postgrad', 'both']).default('both'),
  discipline: z.string().trim().max(200).nullable().optional(),
  verified: z.boolean().default(false),
  awards_available: z.number().int().positive().nullable().optional(),
  estimated_applicant_pool: z.number().int().positive().nullable().optional(),
  competitiveness_tier: z.enum(['low', 'medium', 'high', 'very_high']).nullable().optional(),
  historical_acceptance_rate: z.number().min(0).max(1).nullable().optional(),
  competitiveness_notes: z.string().trim().max(2000).nullable().optional(),
  rules: z.array(ruleSchema).optional().default([]),
})

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: ROUTE, limit: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response

  const { data: scholarships, error } = await supabase
    .from('scholarships')
    .select('*, scholarship_rules ( id, field, operator, value )')
    .order('created_at', { ascending: false })
    .limit(ADMIN_LIST_CAP)

  if (error) return dbErrorResponse(ROUTE, error)

  return NextResponse.json({ scholarships })
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: ROUTE, limit: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response

  const raw = await request.json().catch(() => null)
  const parsed = scholarshipSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid scholarship data', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { rules, ...scholarshipFields } = parsed.data

  const { data: scholarship, error: insertError } = await supabase
    .from('scholarships')
    .insert({ ...scholarshipFields, created_by: guard.userId })
    .select('*')
    .single()

  if (insertError) return dbErrorResponse(ROUTE, insertError)

  if (rules.length > 0) {
    const { error: rulesError } = await supabase.from('scholarship_rules').insert(
      rules.map((r) => ({ ...r, scholarship_id: scholarship.id }))
    )
    if (rulesError) {
      return NextResponse.json(
        {
          error: 'Scholarship created but rules failed to save',
          details: rulesError.message,
          scholarship,
        },
        { status: 207 }
      )
    }
  }

  const { data: full } = await supabase
    .from('scholarships')
    .select('*, scholarship_rules ( id, field, operator, value )')
    .eq('id', scholarship.id)
    .single()

  return NextResponse.json({ scholarship: full ?? scholarship }, { status: 201 })
}
