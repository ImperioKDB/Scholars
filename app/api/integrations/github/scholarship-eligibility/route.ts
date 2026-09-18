import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/ratelimit'
import { z } from 'zod'

const inputSchema = z.object({ candidate_ids: z.array(z.string().uuid()).min(1).max(25) })
const reportSchema = z.object({
  verdict: z.enum(['eligible', 'likely_eligible', 'unclear', 'not_eligible']),
  confidence: z.number().min(0).max(1),
  nigeria_eligible: z.boolean().nullable(),
  undergraduate_eligible: z.boolean().nullable(),
  reasons: z.array(z.string().max(500)).max(8),
  requirements: z.array(z.string().max(500)).max(12),
  contradictions: z.array(z.string().max(500)).max(8),
  evidence_quotes: z.array(z.string().max(500)).max(8),
})
type Candidate = { id: string; title: string; provider_name: string; description: string | null; level: string; eligibility_notes: string | null; evidence_excerpt: string; source_url: string; application_url: string | null }

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

async function reviewCandidate(candidate: Candidate) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')
  const prompt = `You are an evidence-first scholarship eligibility reviewer. Review only the supplied text. Do not browse, invent facts, or infer eligibility from a missing statement. The audience is Nigerian undergraduate students. This is advisory: uncertainty is safer than a false positive.

Return JSON only with exactly these keys: verdict (eligible, likely_eligible, unclear, not_eligible), confidence (0 to 1), nigeria_eligible (true, false, or null), undergraduate_eligible (true, false, or null), reasons (array), requirements (array), contradictions (array), evidence_quotes (array). Keep every array concise. Use verdict eligible only when both Nigerian and undergraduate eligibility are explicitly supported by the evidence. Use likely_eligible when evidence is suggestive but incomplete. Use unclear when either location or study level is missing or ambiguous. Use not_eligible only when the evidence clearly excludes Nigerian undergraduates.

Title: ${candidate.title}
Provider: ${candidate.provider_name}
Level field: ${candidate.level}
Description: ${candidate.description ?? 'not provided'}
Eligibility notes: ${candidate.eligibility_notes ?? 'not provided'}
Evidence excerpt: ${candidate.evidence_excerpt}
Source URL: ${candidate.source_url}
Application URL: ${candidate.application_url ?? 'not provided'}`
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 1200, responseMimeType: 'application/json' } }) })
  if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}`)
  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim()
  if (!text) throw new Error('Gemini returned no review')
  const parsed = reportSchema.safeParse(JSON.parse(text))
  if (!parsed.success) throw new Error('Eligibility review failed schema validation')
  return parsed.data
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data, error } = await service.from('scholarship_discovery_candidates').select('id').eq('quality_status', 'ready').in('eligibility_review_status', ['unreviewed', 'error']).neq('status', 'rejected').limit(25)
  if (error) return NextResponse.json({ error: 'Could not load candidates for eligibility review' }, { status: 500 })
  return NextResponse.json({ candidate_ids: (data ?? []).map((candidate) => candidate.id) })
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = await checkRateLimit(request, { route: 'github-scholarship-eligibility', limit: 5 }); if (limited) return limited
  const parsed = inputSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Invalid candidate IDs', issues: parsed.error.issues }, { status: 400 })
  const service = createServiceClient()
  const { data: candidates, error: readError } = await service.from('scholarship_discovery_candidates').select('id,title,provider_name,description,level,eligibility_notes,evidence_excerpt,source_url,application_url').in('id', parsed.data.candidate_ids).eq('quality_status', 'ready').limit(25)
  if (readError) return NextResponse.json({ error: 'Could not load candidates' }, { status: 500 })
  const results = []
  for (const candidate of (candidates ?? []) as Candidate[]) {
    try {
      const report = await reviewCandidate(candidate)
      const { error } = await service.from('scholarship_discovery_candidates').update({ eligibility_review_status: 'reviewed', eligibility_verdict: report.verdict, eligibility_confidence: report.confidence, eligibility_report: report, eligibility_review_error: null, eligibility_reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', candidate.id)
      results.push({ id: candidate.id, ...report, updated: !error })
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Eligibility review failed'
      await service.from('scholarship_discovery_candidates').update({ eligibility_review_status: 'error', eligibility_review_error: message, eligibility_reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', candidate.id)
      results.push({ id: candidate.id, error: message, updated: false })
    }
  }
  return NextResponse.json({ ok: true, reviewed: results.filter((item) => 'verdict' in item).length, failed: results.filter((item) => 'error' in item).length, results })
}
