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
// ruleSchema.field was stale until this fix -- it only accepted the
// original 7 fields (including a since-dropped 'academic_level'), while
// the admin UI (RuleBuilder.tsx, ADMIN_RULE_FIELDS in
// lib/admin/scholarship.ts) already offered the full undergrad-pivot
// field set. Submitting a rule on year_of_study, institution_type,
// jamb_score, waec_credit_count, state_of_origin, lga_of_origin, age,
// has_english_maths_credit, or disability_status through the real admin
// form hit a 400 here. Enum now matches ADMIN_RULE_FIELDS exactly.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const ruleSchema = z.object({
  field: z.enum([
    'discipline',
    'gpa',
    'nationality',
    'gender',
    'financial_need',
    'age',
    'state_of_origin',
    'lga_of_origin',
    'year_of_study',
    'institution_type',
    'jamb_score',
    'waec_credit_count',
    'has_english_maths_credit',
    'disability_status',
    'career_goals',
  ]),
  operator: z.enum(['eq', 'gte', 'lte', 'in', 'exists']),
  value: z.unknown(),
})

const scholarshipSchema = z.object({
  title: z.string().trim().min(1).max(300),
  provider_name: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).nullable().optional(),
  amount: z.string().trim().max(200).nullable().optional(),
  deadline: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
  application_url: z.string().url().nullable().optional(),
  level: z.enum(['undergrad', 'postgrad', 'both']).default('both'),
  discipline: z.string().trim().max(200).nullable().optional(),
  verified: z.boolean().default(false),
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

export async function GET() {
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
