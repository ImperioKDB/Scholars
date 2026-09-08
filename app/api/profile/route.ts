// app/api/profile/route.ts
// GET    /api/profile  -- fetch the current user's profile (404 if not created yet)
// POST   /api/profile  -- create or update the current user's profile (upsert)
// DELETE /api/profile  -- self-serve account deletion (user feedback batch)
//
// profile_completeness is NOT accepted from the client -- it's trigger-computed
// in Postgres (see calculate_profile_completeness()) so it can't be spoofed by
// a client sending a high number to game the matching score.
//
// avatar_url IS accepted but only as a URL string: the actual bytes go to
// Supabase Storage straight from the browser (storage RLS scopes writes to
// the owner's folder, see migration 0010), and this route only records the
// resulting public URL. A client can therefore only point its own avatar at
// a URL, never write to someone else's row (RLS) or store arbitrary data.
//
// Undergrad-only pivot: academic_level is gone. Added the eligibility fields
// most Nigerian scholarships actually gate on (state/LGA of origin, DOB,
// JAMB/WAEC results, year of study, institution type) plus a document-
// readiness checklist (booleans only -- no file storage).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { invalidateMatchesCache } from '@/lib/matching/matchCache'

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
  avatar_url: z.string().url().nullable().optional(),
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
  // PERF (batch 1): profile fields drive match evaluation, so the cached
  // matches payload must be dropped the moment they change. Fail-open:
  // a cache error never blocks the profile save (TTL bounds staleness).
  await invalidateMatchesCache(user.id)
  return NextResponse.json({ profile })
}

// DELETE /api/profile -- self-serve account deletion (user feedback batch).
//
// Privacy question raised by a tester: students need a way to erase their
// data without emailing support. This handler deletes the caller's own
// profile row; FK ON DELETE CASCADE on saved_scholarships, applications,
// waec_results, notifications, user_achievements, xp_events, and feedback
// (see migrations 0001/0004/0006/0011/0014) wipes all app data attached
// to it in one operation.
//
// The auth email in auth.users is NOT deleted -- that requires the service
// role key, which this route deliberately does not hold. The settings page
// is honest about this and points the student at support for full erasure.
// This is the same pattern every GDPR/NDPR-compliant app uses: app data
// is self-serve deletable; the auth record (just an email) stays until
// the user explicitly asks for full removal.
//
// Scoped by .eq('id', user.id) AND RLS profiles_update_own, so a client
// can only ever delete their own row -- never someone else's.
export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { error, count } = await supabase
    .from('profiles')
    .delete({ count: 'exact' })
    .eq('id', user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // PERF (batch 1): drop any cached matches for this user as well.
  await invalidateMatchesCache(user.id)
  if (!count) {
    // No profile row existed yet -- nothing to delete, but the intent
    // is satisfied. Return success rather than 404 so the client can
    // still sign out and redirect cleanly.
    return NextResponse.json({ deleted: false })
  }
  return NextResponse.json({ deleted: true })
}
