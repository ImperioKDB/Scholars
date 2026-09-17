import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/ratelimit'
import { z } from 'zod'

const inputSchema = z.object({ candidate_ids: z.array(z.string().uuid()).min(1).max(100) })
function authorized(request: Request) { const secret = process.env.CRON_SECRET; return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`) }
function score(candidate: Record<string, unknown>) {
  const issues: string[] = []
  let points = 0
  if (typeof candidate.title === 'string' && candidate.title.trim().length >= 12) points += 1; else issues.push('Title is missing or too short')
  if (typeof candidate.provider_name === 'string' && candidate.provider_name.trim().length >= 3) points += 1; else issues.push('Provider name is missing')
  if (typeof candidate.description === 'string' && candidate.description.trim().length >= 80) points += 1; else issues.push('Description is missing or too brief')
  if (typeof candidate.deadline === 'string' && candidate.deadline) points += 1; else issues.push('Deadline was not extracted')
  if (typeof candidate.application_url === 'string' && candidate.application_url) points += 1; else issues.push('Application URL is missing')
  if (candidate.level === 'undergraduate' || candidate.level === 'multiple') points += 1; else issues.push('Undergraduate eligibility is unclear')
  if (typeof candidate.evidence_excerpt === 'string' && candidate.evidence_excerpt.trim().length >= 120) points += 1; else issues.push('Evidence excerpt is too brief')
  if (typeof candidate.confidence === 'number' && candidate.confidence >= 0.7) points += 1; else issues.push('Extraction confidence is below 70%')
  const qualityScore = Number((points / 8).toFixed(3))
  return { qualityScore, issues, status: qualityScore >= 0.875 ? 'ready' : qualityScore >= 0.625 ? 'needs_review' : 'insufficient' }
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data, error } = await service.from('scholarship_discovery_candidates').select('id').eq('quality_status', 'unscored').neq('status', 'rejected').order('created_at', { ascending: true }).limit(100)
  if (error) return NextResponse.json({ error: 'Could not load candidates for quality scoring' }, { status: 500 })
  return NextResponse.json({ candidate_ids: (data ?? []).map((candidate) => candidate.id) })
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = await checkRateLimit(request, { route: 'github-scholarship-quality', limit: 10 }); if (limited) return limited
  const parsed = inputSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Invalid candidate IDs', issues: parsed.error.issues }, { status: 400 })
  const service = createServiceClient()
  const { data: candidates, error: readError } = await service.from('scholarship_discovery_candidates').select('id,title,provider_name,description,deadline,application_url,level,evidence_excerpt,confidence').in('id', parsed.data.candidate_ids).limit(100)
  if (readError) return NextResponse.json({ error: 'Could not load candidates' }, { status: 500 })
  const results = []
  for (const candidate of candidates ?? []) {
    const result = score(candidate)
    const { error } = await service.from('scholarship_discovery_candidates').update({ quality_status: result.status, quality_score: result.qualityScore, quality_issues: result.issues, quality_scored_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', candidate.id)
    results.push({ id: candidate.id, ...result, updated: !error })
  }
  return NextResponse.json({ ok: true, scored: results.length, ready: results.filter((item) => item.status === 'ready').length, needs_review: results.filter((item) => item.status === 'needs_review').length, insufficient: results.filter((item) => item.status === 'insufficient').length, results })
}
