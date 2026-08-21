// app/api/scholarships/route.ts
// GET /api/scholarships — list verified scholarships.
//
// Optional query params:
//   level        'undergrad' | 'postgrad' | 'both'  (filters, doesn't fold 'both' logic — that's the matching engine's job)
//   discipline   string, case-insensitive partial match
//   limit        default 50, max 100
//   offset       default 0
//
// This route is deliberately dumb (no eligibility logic) — it's for
// browsing/search, not matching. Use POST /api/scholarships/match for
// personalized ranked results.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const querySchema = z.object({
  level: z.enum(['undergrad', 'postgrad', 'both']).optional(),
  discipline: z.string().trim().min(1).max(200).optional(),
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
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query params', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { level, discipline, limit, offset } = parsed.data

  let query = supabase
    .from('scholarships')
    .select(
      'id, title, provider_name, description, amount, deadline, application_url, level, discipline, verified',
      { count: 'exact' }
    )
    .eq('verified', true)
    .order('deadline', { ascending: true })
    .range(offset, offset + limit - 1)

  if (level) query = query.eq('level', level)
  if (discipline) query = query.ilike('discipline', `%${discipline}%`)

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
