// app/api/scholarships/route.ts
// GET /api/scholarships -- list verified scholarships.
//
// Optional query params:
//   level        'undergrad' | 'both'  (filters within the undergrad-eligible set)
//   discipline   string, case-insensitive partial match
//   q            free-text keyword search across title + provider name
//                (added in audit-fix batch 4 for the student-facing
//                Browse page, app/discover)
//   limit        default 50, max 100
//   offset       default 0
//
// Undergrad-only pivot: postgrad-only listings are excluded unconditionally,
// not just when a caller happens to filter by level -- this platform no
// longer serves postgrad students at all.
//
// This route is deliberately dumb (no eligibility logic) -- it's for
// browsing/search, not matching. Use POST /api/scholarships/match for
// personalized ranked results.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const querySchema = z.object({
  level: z.enum(['undergrad', 'both']).optional(),
  discipline: z.string().trim().min(1).max(200).optional(),
  // AUDIT FIX (batch 4): keyword search for the Browse page. Commas and
  // parentheses are stripped below before reaching PostgREST's .or()
  // syntax -- they'd otherwise be parsed as filter delimiters and
  // corrupt the expression.
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

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
    level: searchParams.get('level') ?? undefined,
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

  const { level, discipline, q, limit, offset } = parsed.data

  let query = supabase
    .from('scholarships')
    .select(
      'id, title, provider_name, description, amount, deadline, application_url, level, discipline, verified',
      { count: 'exact' }
    )
    .eq('verified', true)
    .in('level', ['undergrad', 'both'])
    .order('deadline', { ascending: true })
    .range(offset, offset + limit - 1)

  if (level) query = query.eq('level', level)
  if (discipline) query = query.ilike('discipline', `%${discipline}%`)
  if (q) {
    const safe = q.replace(/[%,()]/g, ' ').trim()
    if (safe) {
      query = query.or(`title.ilike.%${safe}%,provider_name.ilike.%${safe}%`)
    }
  }

  const { data: scholarships, error, count } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    scholarships,
    total: count ?? scholarships?.length ?? 0,
    limit,
    offset,
  })
}
