// app/api/opportunities/route.ts
// GET /api/opportunities -- list verified opportunities (fellowships,
// internships, competitions, mentorships).
//
// Optional query params:
//   type         'fellowship' | 'internship' | 'competition' | 'mentorship'
//   discipline   string, case-insensitive partial match
//   q            free-text keyword search across title + provider name
//   limit        default 50, max 100
//   offset       default 0
//
// Deliberately dumb, same as GET /api/scholarships -- no eligibility
// scoring. Opportunities are discovery-only in v1: no rules engine, no
// MatchSeal, no dashboard tab. Ordered by deadline ascending with nulls
// last, so time-sensitive items surface first and rolling/no-deadline
// items (mentorships, ongoing internships) settle to the bottom rather
// than dominating the top of the list.
//
// INPUT HARDENING: same treatment as GET /api/scholarships -- ILIKE
// wildcards escaped for `discipline`, PostgREST structural characters
// stripped and wildcards escaped for `q`.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { escapeLikePattern, sanitizeSearchText } from '@/lib/validate'

const querySchema = z.object({
  type: z.enum(['fellowship', 'internship', 'competition', 'mentorship']).optional(),
  discipline: z.string().trim().min(1).max(200).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const OPPORTUNITY_COLUMNS =
  'id, type, title, provider_name, description, duration, location, compensation, discipline, deadline, opens_at, application_url, how_to_apply, verified'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    type: searchParams.get('type') ?? undefined,
    discipline: searchParams.get('discipline') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query params', issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const { type, discipline, q, limit, offset } = parsed.data

  let query = supabase
    .from('opportunities')
    .select(OPPORTUNITY_COLUMNS, { count: 'exact' })
    .eq('verified', true)
    .order('deadline', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (type) query = query.eq('type', type)
  if (discipline) query = query.ilike('discipline', `%${escapeLikePattern(discipline)}%`)
  if (q) {
    const safe = sanitizeSearchText(q)
    if (safe) {
      query = query.or(`title.ilike.%${safe}%,provider_name.ilike.%${safe}%`)
    }
  }

  const { data: opportunities, error, count } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    opportunities,
    total: count ?? opportunities?.length ?? 0,
    limit,
    offset,
  })
}
