// app/api/scholarships/match/route.ts
// POST /api/scholarships/match
//
// Given the requesting user's own profile, evaluates every verified
// scholarship's rules and returns a ranked list of matches. Uses the
// RLS-scoped server client (not the service role key) — the user only
// ever reads their own profile and publicly-verified scholarships,
// which their own RLS policies already permit, so no elevated access
// is needed here.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { computeMatches, type Profile, type Scholarship } from '@/lib/matching/engine'

const bodySchema = z
  .object({
    includeIneligible: z.boolean().optional().default(false),
  })
  .optional()

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let includeIneligible = false
  try {
    const raw = await request.json().catch(() => undefined)
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: parsed.error.issues },
        { status: 400 }
      )
    }
    includeIneligible = parsed.data?.includeIneligible ?? false
  } catch {
    // no body sent — fine, use defaults
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'id, academic_level, discipline, gpa, nationality, gender, financial_need, career_goals, profile_completeness'
    )
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Profile not found. Complete your profile before matching.' },
      { status: 404 }
    )
  }

  const { data: scholarships, error: scholarshipsError } = await supabase
    .from('scholarships')
    .select(
      \`id, title, provider_name, description, amount, deadline, application_url,
       level, discipline, verified,
       scholarship_rules ( id, scholarship_id, field, operator, value )\`
    )
    .eq('verified', true)

  if (scholarshipsError) {
    return NextResponse.json(
      { error: 'Failed to load scholarships', details: scholarshipsError.message },
      { status: 500 }
    )
  }

  const matches = computeMatches(
    profile as Profile,
    (scholarships ?? []) as unknown as Scholarship[],
    { includeIneligible }
  )

  return NextResponse.json({
    profile_completeness: profile.profile_completeness,
    total_evaluated: scholarships?.length ?? 0,
    total_eligible: matches.filter((m) => m.eligible).length,
    matches,
  })
}
