// app/api/scholarships/[id]/route.ts
// GET /api/scholarships/[id]
//
// Single verified scholarship, evaluated against the current user's
// profile (same engine as POST /api/scholarships/match), plus whether the
// user has already saved it or is tracking an application for it. Powers
// the scholarship detail page. Deliberately separate from GET
// /api/scholarships (dumb browse/search list) and POST
// /api/scholarships/match (ranked list) -- neither returns per-item
// save/tracking state.
//
// INPUT HARDENING: the id path param is user input. A malformed (non-
// UUID) id is rejected with a clean 404 here instead of reaching
// Postgres as a cast error and surfacing as a 500.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMatchForScholarship } from '@/lib/matching/getMatches'
import { isUuid } from '@/lib/validate'

type ApplicationStatus = 'in_progress' | 'submitted' | 'accepted' | 'rejected'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Scholarship not found' }, { status: 404 })
  }

  const { match, profileCompleteness, error } = await getMatchForScholarship(id)

  if (error === 'not_authenticated') {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (error === 'profile_not_found') {
    return NextResponse.json(
      { error: 'Profile not found. Complete your profile before matching.' },
      { status: 404 }
    )
  }
  if (error === 'not_found') {
    return NextResponse.json({ error: 'Scholarship not found' }, { status: 404 })
  }
  if (error || !match) {
    return NextResponse.json({ error: 'Failed to load scholarship' }, { status: 500 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let saved = false
  let application: { id: string; status: ApplicationStatus } | null = null
  if (user) {
    const [savedResult, applicationResult] = await Promise.all([
      supabase
        .from('saved_scholarships')
        .select('id')
        .eq('profile_id', user.id)
        .eq('scholarship_id', id)
        .maybeSingle(),
      supabase
        .from('applications')
        .select('id, status')
        .eq('profile_id', user.id)
        .eq('scholarship_id', id)
        .maybeSingle(),
    ])
    saved = Boolean(savedResult.data)
    application = (applicationResult.data as { id: string; status: ApplicationStatus } | null) ?? null
  }

  return NextResponse.json({
    scholarship: match,
    profile_completeness: profileCompleteness,
    saved,
    application,
  })
}
