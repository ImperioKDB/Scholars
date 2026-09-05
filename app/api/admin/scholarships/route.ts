// app/api/admin/scholarships/route.ts
// GET  /api/admin/scholarships — list ALL scholarships (verified + unverified), admin only.
//      SCOPE NOTE: not in 05_CODING_WORKFLOW.md's route list, but the admin
//      panel (01_PRD.md #8) needs to see drafts/unverified entries to
//      review and verify them, and there's no other route that returns
//      unverified rows (GET /api/scholarships is verified-only by RLS).
//      Flagging as a deliberate addition.
// POST /api/admin/scholarships — create a scholarship, optionally with
//      inline eligibility rules, admin only.
//
// Defense in depth: RLS already restricts writes to is_admin(auth.uid()),
// but we also check profile.is_admin server-side before attempting the
// mutation, so a non-admin gets a clear 403 instead of a confusing RLS
// failure buried in a Postgres error.
//
// how_to_apply added to the insert payload: fallback guidance shown to
// students when application_url is blank -- see migration:
// add_how_to_apply_fallback.
//
// opens_at added: date applications open, optional/nullable -- see
// migration: add_opens_at_and_trending_fn. Feeds the "Open now" badge
// (lib/discovery.ts), never the matching engine.
//
// awards_available / estimated_applicant_pool / competitiveness_tier /
// historical_acceptance_rate / competitiveness_notes added: competitiveness
// inputs consumed by lib/matching/engine.ts's computeCompetitivenessFactor
// -- see migration: add_competitiveness_fields. All optional/nullable; the
// client (app/admin/scholarships/new/page.tsx) sends already-converted
// numbers or null, not raw form strings.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'

const ruleSchema = z.object({
  field: z.enum(['gpa', 'nationality', 'gender', 'financial_need', 'academic_level', 'discipline', 'career_goals']),
  operator: z.enum(['eq', 'gte', 'lte', 'in', 'exists']),
  value: z.unknown(),
})

const scholarshipSchema = z.object({
  title: z.string().trim().min(1).max(300),
  provider_name: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).nullable().optional(),
  amount: z.string().trim().max(200).nullable().optional(),
  deadline: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
  opens_at: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date'),
  application_url: z.string().url().nullable().optional(),
  how_to_apply: z.string().trim().max(2000).nullable().optional(),
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

export async function GET(request: Request) {
  // SECURITY HARDENING (phase 1): admin surface gets a higher ceiling
  // (60/min) because is_admin + middleware already gate it; the limiter
  // is a brute-force brake, not the primary control.
  const limited = await checkRateLimit(request, { route: 'admin-scholarships', limit: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const check = await requireAdmin(supabase)
  if (check.error) return check.error
  const { data: scholarships, error } = await supabase
    .from('scholarships')
    .select('*, scholarship_rules ( id, field, operator, value )')
    .order('created_at', { ascending: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ scholarships })
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-scholarships', limit: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const check = await requireAdmin(supabase)
  if (check.error) return check.error
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
    .insert({ ...scholarshipFields, created_by: check.user!.id })
    .select('*')
    .single()
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }
  if (rules.length > 0) {
    const { error: rulesError } = await supabase.from('scholarship_rules').insert(
      rules.map((r) => ({ ...r, scholarship_id: scholarship.id }))
    )
    if (rulesError) {
      // Scholarship was created but rules failed — surface this clearly
      // rather than silently leaving a scholarship with no rules.
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
