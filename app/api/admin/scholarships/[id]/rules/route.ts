// app/api/admin/scholarships/[id]/rules/route.ts
// POST /api/admin/scholarships/[id]/rules — add a single eligibility rule
// to an existing scholarship, admin only.
//
// For bulk rule replacement, it's simpler to DELETE each old rule via
// /api/admin/scholarships/[id]/rules/[ruleId] and POST new ones, rather
// than a "replace all" endpoint — keeps each operation small and auditable
// rather than one call silently wiping and rebuilding a rule set.
//
// ruleSchema.field widened to match ADMIN_RULE_FIELDS in
// lib/admin/scholarship.ts -- see app/api/admin/scholarships/route.ts for
// the full note on why this was stale.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'

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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: scholarshipId } = await params
  // SECURITY HARDENING (phase 1): see the 60/min note on the list route.
  const limited = await checkRateLimit(request, { route: 'admin-rules', limit: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const check = await requireAdmin(supabase)
  if (check.error) return check.error
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
    // 23503 = foreign_key_violation — scholarship_id doesn't exist
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Scholarship not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ rule }, { status: 201 })
}
