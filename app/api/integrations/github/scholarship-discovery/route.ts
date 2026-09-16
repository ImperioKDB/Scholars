import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/ratelimit'
import { httpUrlSchema } from '@/lib/validate'
import { z } from 'zod'

const candidateSchema = z.object({
  source_id: z.string().uuid(),
  source_url: httpUrlSchema,
  application_url: httpUrlSchema.optional().nullable(),
  canonical_url: httpUrlSchema.optional().nullable(),
  title: z.string().trim().min(3).max(300),
  provider_name: z.string().trim().min(2).max(300),
  description: z.string().trim().max(5000).optional().nullable(),
  amount: z.string().trim().max(300).optional().nullable(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  level: z.enum(['undergraduate', 'postgraduate', 'secondary', 'multiple', 'unclear']).default('unclear'),
  discipline: z.string().trim().max(300).optional().nullable(),
  eligibility_notes: z.string().trim().max(4000).optional().nullable(),
  evidence_excerpt: z.string().trim().min(20).max(10000),
  fetched_at: z.string().datetime().optional(),
  content_hash: z.string().trim().max(200).optional().nullable(),
  confidence: z.number().min(0).max(1).optional().nullable(),
  idempotency_key: z.string().trim().min(12).max(300).regex(/^[A-Za-z0-9._:/-]+$/),
})

const batchSchema = z.object({ candidates: z.array(candidateSchema).min(1).max(100) })

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  return Boolean(expected && request.headers.get('authorization') === `Bearer ${expected}`)
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data, error } = await service
    .from('discovery_sources')
    .select('id,name,base_url,source_type,trust_tier,enabled,crawl_policy')
    .eq('enabled', true)
    .limit(50)
  if (error) return NextResponse.json({ error: 'Could not load discovery sources' }, { status: 500 })
  return NextResponse.json({ sources: data ?? [] })
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = await checkRateLimit(request, { route: 'github-scholarship-discovery', limit: 10 })
  if (limited) return limited
  const parsed = batchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid discovery candidate batch', issues: parsed.error.issues }, { status: 400 })

  const service = createServiceClient()
  const rows = parsed.data.candidates.map((candidate) => ({
    ...candidate,
    fetched_at: candidate.fetched_at ?? new Date().toISOString(),
    status: 'pending_review',
  }))
  const { data, error } = await service
    .from('scholarship_discovery_candidates')
    .upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    .select('id,idempotency_key,status')
  if (error) return NextResponse.json({ error: 'Could not save discovery candidates' }, { status: 500 })
  return NextResponse.json({ ok: true, received: rows.length, inserted: data?.length ?? 0, pending_review: data?.filter((row) => row.status === 'pending_review').length ?? 0 })
}
