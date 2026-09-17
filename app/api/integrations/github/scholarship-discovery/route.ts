import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/ratelimit'
import { httpUrlSchema } from '@/lib/validate'
import { z } from 'zod'

const candidateSchema = z.object({
  source_id: z.string().uuid(), source_url: httpUrlSchema, application_url: httpUrlSchema.optional().nullable(), canonical_url: httpUrlSchema.optional().nullable(),
  title: z.string().trim().min(3).max(300), provider_name: z.string().trim().min(2).max(300), description: z.string().trim().max(5000).optional().nullable(), amount: z.string().trim().max(300).optional().nullable(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(), level: z.enum(['undergraduate', 'postgraduate', 'secondary', 'multiple', 'unclear']).default('unclear'), discipline: z.string().trim().max(300).optional().nullable(), eligibility_notes: z.string().trim().max(4000).optional().nullable(),
  evidence_excerpt: z.string().trim().min(20).max(10000), fetched_at: z.string().datetime().optional(), content_hash: z.string().trim().max(200).optional().nullable(), confidence: z.number().min(0).max(1).optional().nullable(), idempotency_key: z.string().trim().min(12).max(300).regex(/^[A-Za-z0-9._:/-]+$/),
})
const batchSchema = z.object({ candidates: z.array(candidateSchema).min(1).max(100) })
function authorized(request: Request): boolean { const expected = process.env.CRON_SECRET; return Boolean(expected && request.headers.get('authorization') === `Bearer ${expected}`) }
function normalized(value: string | null | undefined): string { return (value ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() }
function similarity(left: string, right: string): number { const a = new Set(normalized(left).split(' ').filter((word) => word.length > 2)); const b = new Set(normalized(right).split(' ').filter((word) => word.length > 2)); if (!a.size || !b.size) return 0; const intersection = [...a].filter((word) => b.has(word)).length; return intersection / new Set([...a, ...b]).size }

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data, error } = await service.from('discovery_sources').select('id,name,base_url,source_type,trust_tier,enabled,crawl_policy').eq('enabled', true).limit(50)
  if (error) return NextResponse.json({ error: 'Could not load discovery sources' }, { status: 500 })
  return NextResponse.json({ sources: data ?? [] })
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = await checkRateLimit(request, { route: 'github-scholarship-discovery', limit: 10 }); if (limited) return limited
  const parsed = batchSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Invalid discovery candidate batch', issues: parsed.error.issues }, { status: 400 })
  const service = createServiceClient()
  const { data: existing, error: existingError } = await service.from('scholarship_discovery_candidates').select('id,canonical_url,title,provider_name,content_hash,status').not('status', 'eq', 'rejected').order('created_at', { ascending: false }).limit(1000)
  if (existingError) return NextResponse.json({ error: 'Could not check discovery duplicates' }, { status: 500 })
  const rows = parsed.data.candidates.map((candidate) => {
    const duplicate = (existing ?? []).map((item) => {
      const exactUrl = Boolean(candidate.canonical_url && item.canonical_url && candidate.canonical_url === item.canonical_url)
      const exactHash = Boolean(candidate.content_hash && item.content_hash && candidate.content_hash === item.content_hash)
      const titleProvider = similarity(candidate.title, item.title) * 0.7 + similarity(candidate.provider_name, item.provider_name) * 0.3
      return { item, score: exactUrl ? 1 : exactHash ? 0.98 : titleProvider }
    }).sort((left, right) => right.score - left.score)[0]
    const isDuplicate = Boolean(duplicate && duplicate.score >= 0.82)
    return { ...candidate, fetched_at: candidate.fetched_at ?? new Date().toISOString(), status: 'pending_review', duplicate_of: isDuplicate ? duplicate?.item.id : null, duplicate_score: isDuplicate ? Number(duplicate?.score.toFixed(3)) : null, duplicate_reason: isDuplicate ? 'Matches an existing discovery by canonical URL, content hash, or normalized title/provider.' : null }
  })
  const { data, error } = await service.from('scholarship_discovery_candidates').upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true }).select('id,idempotency_key,status,duplicate_of,duplicate_score')
  if (error) return NextResponse.json({ error: 'Could not save discovery candidates' }, { status: 500 })
  return NextResponse.json({ ok: true, received: rows.length, inserted: data?.length ?? 0, duplicates: data?.filter((row) => row.duplicate_of).length ?? 0, pending_review: data?.filter((row) => row.status === 'pending_review').length ?? 0 })
}
