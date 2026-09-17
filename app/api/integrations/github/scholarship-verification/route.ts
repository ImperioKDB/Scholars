import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/ratelimit'
import { z } from 'zod'

const inputSchema = z.object({ candidate_ids: z.array(z.string().uuid()).min(1).max(100) })
function authorized(request: Request) { const secret = process.env.CRON_SECRET; return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`) }

async function checkUrl(url: string) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(12000), headers: { 'user-agent': 'ScholarsBot/1.0 (+https://scholars.com.ng)' } })
    const reachable = response.status >= 200 && response.status < 400
    return { status: reachable ? (response.url === url ? 'verified' : 'redirected') : 'unreachable', httpStatus: response.status, finalUrl: response.url, notes: reachable ? null : `Source returned HTTP ${response.status}` }
  } catch (error) { return { status: 'unreachable', httpStatus: null, finalUrl: null, notes: error instanceof Error ? error.message.slice(0, 500) : 'Request failed' } }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = await checkRateLimit(request, { route: 'github-scholarship-verification', limit: 10 }); if (limited) return limited
  const parsed = inputSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Invalid candidate IDs', issues: parsed.error.issues }, { status: 400 })
  const service = createServiceClient()
  const { data: candidates, error: readError } = await service.from('scholarship_discovery_candidates').select('id,source_url,canonical_url,status').in('id', parsed.data.candidate_ids).limit(100)
  if (readError) return NextResponse.json({ error: 'Could not load candidates' }, { status: 500 })
  const results = []
  for (const candidate of candidates ?? []) {
    const result = await checkUrl(candidate.canonical_url ?? candidate.source_url)
    const { error } = await service.from('scholarship_discovery_candidates').update({ verification_status: result.status, verification_http_status: result.httpStatus, verification_final_url: result.finalUrl, verification_notes: result.notes, last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', candidate.id)
    results.push({ id: candidate.id, ...result, updated: !error })
  }
  return NextResponse.json({ ok: true, checked: results.length, verified: results.filter((item) => item.status === 'verified' || item.status === 'redirected').length, unreachable: results.filter((item) => item.status === 'unreachable').length, results })
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data, error } = await service.from('scholarship_discovery_candidates').select('id').in('verification_status', ['unverified', 'stale', 'unreachable']).neq('status', 'rejected').order('created_at', { ascending: true }).limit(100)
  if (error) return NextResponse.json({ error: 'Could not load candidates for verification' }, { status: 500 })
  return NextResponse.json({ candidate_ids: (data ?? []).map((candidate) => candidate.id) })
}
