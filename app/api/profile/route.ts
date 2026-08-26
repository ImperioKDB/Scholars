// app/api/profile/route.ts
// GET  /api/profile  -- fetch the current user's profile (404 if not created yet)
// POST /api/profile  -- create or update the current user's profile (upsert)
//
// profile_completeness is NOT accepted from the client -- it's trigger-computed
// in Postgres (see calculate_profile_completeness()) so it can't be spoofed by
// a client sending a high number to game the matching score.
//
// Undergrad-only pivot: academic_level is gone. Added the eligibility fields
// most Nigerian scholarships actually gate on (state/LGA of origin, DOB,
// JAMB/WAEC results, year of study, institution type) plus a document-
// readiness checklist (booleans only -- no file storage).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const profileSchema = z.object({
  full_name: z.string().trim().min(1).max(200).nullable().optional(),
  discipline: z.string().trim().min(1).max(200).nullable().optional(),
  gpa: z.number().min(0).max(5.0).nullable().optional(), // Nigerian CGPA is commonly /5.0
  nationality: z.string().trim().min(1).max(100).nullable().optional(),
  gender: z.string().trim().min(1).max(50).nullable().optional(),
  financial_need: z.boolean().optional(),
  career_goals: z.string().trim().max(2000).nullable().optional(),
  date_of_birth: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
    .nullable()
    .optional(),
  state_of_origin: z.string().trim().min(1).max(100).nullable().optional(),
  lga_of_origin: z.string().trim().min(1).max(150).nullable().optional(),
  year_of_study: z.number().int().min(100).max(600).nullable().optional(),
  institution_name: z.string().trim().min(1).max(300).nullable().optional(),
  institution_type: z
    .enum(['federal_uni', 'state_uni', 'private_uni', 'polytechnic', 'college_of_education'])
    .nullable()
    .optional(),
  jamb_score: z.number().int().min(0).max(400).nullable().optional(),
  waec_credit_count: z.number().int().min(0).max(9).nullable().optional(),
  has_english_maths_credit: z.boolean().optional(),
  disability_status: z.boolean().optional(),
  has_valid_id: z.boolean().optional(),
  has_transcript: z.boolean().optional(),
  has_recommendation_letter: z.boolean().optional(),
  has_personal_statement: z.boolean().optional(),
  has_lga_certificate: z.boolean().optional(),
})

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = profileSchema.safeParse(raw)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid profile data', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, ...parsed.data }, { onConflict: 'id' })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile })
}
