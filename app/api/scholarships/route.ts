// app/api/scholarships/route.ts
// GET /api/scholarships -- dumb browse/search catalog for /discover.
//
// REFACTOR BATCH 1: rate-limit parity with the other student-facing reads
// (60/min per IP). Browse is the most hammerable public-ish endpoint in
// the student surface (keyword search fires on every debounced keystroke),
// so it gets the same Upstash sliding window everything else uses.
//
// INPUT HARDENING: `discipline` and `q` are user input flowing into
// PostgREST filters. discipline now has its ILIKE wildcards escaped so it
// matches literally; q is sanitized for the .or() fragment (structural
// characters stripped, wildcards escaped) so it can neither break out of
// its %...% wrapper nor widen the match. Values stay parameterized by
// supabase-js either way -- this closes filter-syntax and wildcard abuse,
// not classic SQLi (which PostgREST already prevents).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { escapeLikePattern, sanitizeSearchText } from '@/lib/validate'

const querySchema = z.object({
  level: z.enum(['undergrad', 'both']).optional(),
  discipline: z.string().trim().min(1).max(200).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: 'scholarships-browse', limit: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    level: searchParams.get('level') ?? undefined,
    discipline: searchParams.get('discipline') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query params', issues: parsed.error.issues }, { status: 400 })
  }
  const { level, discipline, q, limit, offset } = parsed.data

  let query = supabase
    .from('scholarships')
    .select(
      'id, title, provider_name, description, amount, deadline, opens_at, last_cycle_closed_at, application_url, level, discipline, verified',
      { count: 'exact' }
    )
    .eq('verified', true)
    .in('level', ['undergrad', 'both'])
    .order('deadline', { ascending: true })
    .range(offset, offset + limit - 1)

  if (level) query = query.eq('level', level)
  if (discipline) query = query.ilike('discipline', `%${escapeLikePattern(discipline)}%`)
  if (q) {
    const safe = sanitizeSearchText(q)
    if (safe) query = query.or(`title.ilike.%${safe}%,provider_name.ilike.%${safe}%`)
  }

  const { data: scholarships, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    scholarships,
    total: count ?? scholarships?.length ?? 0,
    limit,
    offset,
  })
}
