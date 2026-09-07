// app/api/admin/scholarships/[id]/rules/route.ts
// POST /api/admin/scholarships/[id]/rules — add a single eligibility rule
// to an existing scholarship, admin only.
//
// The rules API only exposes add-one / delete-one, deliberately, to keep
// each write small and auditable rather than one call silently wiping and
// rebuilding a rule set.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { assertAdmin } from '@/lib/admin/guard'

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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: scholarshipId } = await params
  const limited = await checkRateLimit(request, { route: 'admin-rules', limit: 60 })
  if (limited) return limited
  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response
  const raw = await request.json().catch(() => null)
  const parsed = ruleSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid rule data', issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const { data: rule, error } = await supabase
    .from('scholarship_rules')
    .insert({ ...parsed.data, scholarship_id: scholarshipId })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Scholarship not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ rule }, { status: 201 })
}
