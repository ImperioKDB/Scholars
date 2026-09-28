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
  const { data: candidates, error: readError } = await service.from('scholarship_discovery_candidates').select('id,source_url,application_url,canonical_url,status').in('id', parsed.data.candidate_ids).neq('status', 'rejected').limit(100)
  if (readError) return NextResponse.json({ error: 'Could not load candidates' }, { status: 500 })
  const results = []
  for (const candidate of candidates ?? []) {
    const sourceResult = await checkUrl(candidate.canonical_url ?? candidate.source_url)
    const applicationResult = candidate.application_url ? await checkUrl(candidate.application_url) : null
    const sourceOk = sourceResult.status === 'verified' || sourceResult.status === 'redirected'
    const applicationOk = applicationResult ? applicationResult.status === 'verified' || applicationResult.status === 'redirected' : false
    const status = sourceOk && applicationOk ? (sourceResult.status === 'redirected' || applicationResult?.status === 'redirected' ? 'redirected' : 'verified') : 'unreachable'
    const notes = [
      `Source: ${sourceResult.notes ?? sourceResult.status}${sourceResult.finalUrl ? ` (${sourceResult.finalUrl})` : ''}`,
      applicationResult ? `Application: ${applicationResult.notes ?? applicationResult.status}${applicationResult.finalUrl ? ` (${applicationResult.finalUrl})` : ''}` : 'Application: missing URL',
    ].join(' | ')
    const checkedAt = new Date().toISOString()
    const { error: attemptError } = await service.from('scholarship_discovery_verification_attempts').insert([
      { candidate_id: candidate.id, requested_url: candidate.canonical_url ?? candidate.source_url, final_url: sourceResult.finalUrl, http_status: sourceResult.httpStatus, status: sourceOk && applicationOk ? status : 'error', notes, checked_at: checkedAt },
      ...(candidate.application_url ? [{ candidate_id: candidate.id, requested_url: candidate.application_url, final_url: applicationResult?.finalUrl ?? null, http_status: applicationResult?.httpStatus ?? null, status: applicationOk ? (applicationResult?.status === 'redirected' ? 'redirected' : 'verified') : 'unreachable', notes: applicationResult?.notes ?? null, checked_at: checkedAt }] : []),
    ])
    const { error } = await service.from('scholarship_discovery_candidates').update({ verification_status: status, verification_http_status: applicationResult?.httpStatus ?? sourceResult.httpStatus, verification_final_url: applicationResult?.finalUrl ?? sourceResult.finalUrl, verification_notes: notes, last_verified_at: checkedAt, updated_at: checkedAt }).eq('id', candidate.id)
    results.push({ id: candidate.id, status, source: sourceResult, application: applicationResult, updated: !error && !attemptError })
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
