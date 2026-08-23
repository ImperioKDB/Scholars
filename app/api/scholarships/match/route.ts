// app/api/scholarships/match/route.ts
// POST /api/scholarships/match
//
// Given the requesting user's own profile, evaluates every verified
// scholarship's rules and returns a ranked list of matches. Uses the
// RLS-scoped server client (not the service role key) — the user only
// ever reads their own profile and publicly-verified scholarships,
// which their own RLS policies already permit, so no elevated access
// is needed here.
//
// NOTE: this route originally called a computeMatches(profile, scholarships,
// options) function with its own Profile/Scholarship types. That
// implementation was unintentionally overwritten by a later push to the
// same lib/matching/engine.ts path and can't be recovered, so this route
// has been rewritten against the engine that actually exists today
// (lib/matching/getMatches.ts -> lib/matching/engine.ts). The response
// shape (profile_completeness, total_evaluated, total_eligible, matches)
// is preserved for any existing caller.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getMatchesForCurrentUser } from '@/lib/matching/getMatches'

const bodySchema = z
  .object({
    includeIneligible: z.boolean().optional().default(false),
  })
  .optional()

export async function POST(request: Request) {
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

  const { matches: allMatches, profileCompleteness, error } = await getMatchesForCurrentUser()

  if (error === 'not_authenticated') {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (error === 'profile_not_found') {
    return NextResponse.json(
      { error: 'Profile not found. Complete your profile before matching.' },
      { status: 404 }
    )
  }
  if (error) {
    return NextResponse.json({ error: 'Failed to load scholarships' }, { status: 500 })
  }

  // "eligible" maps to the engine's tier: anything above the "unlikely"
  // floor (gating failure or very low score) counts as eligible.
  const eligible = allMatches.filter((m) => m.tier !== 'unlikely')
  const matches = includeIneligible ? allMatches : eligible

  return NextResponse.json({
    profile_completeness: profileCompleteness,
    total_evaluated: allMatches.length,
    total_eligible: eligible.length,
    matches,
  })
}
