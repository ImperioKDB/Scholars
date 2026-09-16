import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '@/lib/admin/guard'
import { checkRateLimit } from '@/lib/ratelimit'
import { z } from 'zod'

const updateSchema = z.object({
  candidate_id: z.string().uuid(),
  status: z.enum(['approved', 'rejected', 'stale', 'published']),
  rejection_reason: z.string().trim().max(1000).optional().nullable(),
})

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-discovery', limit: 60 })
  if (limited) return limited
  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response
  const [{ data: sources, error: sourcesError }, { data: candidates, error: candidatesError }] = await Promise.all([
    supabase.from('discovery_sources').select('id,name,base_url,source_type,trust_tier,enabled,crawl_policy,last_crawled_at').order('name').limit(50),
    supabase.from('scholarship_discovery_candidates').select('id,source_id,source_url,application_url,title,provider_name,description,amount,deadline,level,discipline,eligibility_notes,evidence_excerpt,fetched_at,confidence,status,rejection_reason,reviewed_at,published_scholarship_id,published_at,created_at').order('created_at', { ascending: false }).limit(100),
  ])
  if (sourcesError || candidatesError) return NextResponse.json({ error: 'Could not load discovery data' }, { status: 500 })
  return NextResponse.json({ sources: sources ?? [], candidates: candidates ?? [] })
}

export async function PATCH(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-discovery', limit: 60 })
  if (limited) return limited
  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid discovery update' }, { status: 400 })
  const { candidate_id: candidateId, status, rejection_reason: rejectionReason } = parsed.data
  if (status === 'published') {
    const { data: candidate, error: candidateError } = await supabase.from('scholarship_discovery_candidates').select('id,status,published_scholarship_id,title,provider_name,description,amount,deadline,application_url,level,discipline,eligibility_notes,evidence_excerpt,source_url').eq('id', candidateId).single()
    if (candidateError || !candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    if (candidate.status !== 'approved') return NextResponse.json({ error: 'Only approved candidates can be published' }, { status: 409 })
    if (candidate.published_scholarship_id) return NextResponse.json({ error: 'Candidate is already published', scholarship_id: candidate.published_scholarship_id }, { status: 409 })
    const level = candidate.level === 'undergraduate' ? 'undergrad' : candidate.level === 'postgraduate' ? 'postgrad' : 'both'
    const { data: scholarship, error: scholarshipError } = await supabase.from('scholarships').insert({ title: candidate.title, provider_name: candidate.provider_name, description: candidate.description, amount: candidate.amount, deadline: candidate.deadline, application_url: candidate.application_url, level, discipline: candidate.discipline, verified: false, created_by: guard.userId, research_notes: `Discovery evidence:\n${candidate.evidence_excerpt}\n\nSource: ${candidate.source_url}\n${candidate.eligibility_notes ?? ''}` }).select('id').single()
    if (scholarshipError || !scholarship) return NextResponse.json({ error: 'Could not publish candidate to catalogue' }, { status: 500 })
    const { data, error } = await supabase.from('scholarship_discovery_candidates').update({ status: 'published', published_scholarship_id: scholarship.id, published_at: new Date().toISOString(), reviewed_by: guard.userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', candidateId).select('id,status,published_scholarship_id,published_at').single()
    if (error) return NextResponse.json({ error: 'Scholarship created but candidate tracking failed', scholarship_id: scholarship.id }, { status: 207 })
    return NextResponse.json({ candidate: data, scholarship_id: scholarship.id })
  }
  const { data, error } = await supabase.from('scholarship_discovery_candidates').update({ status, rejection_reason: rejectionReason ?? null, reviewed_by: guard.userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', candidateId).select('id,status,reviewed_at').single()
  if (error) return NextResponse.json({ error: 'Could not update candidate' }, { status: 500 })
  return NextResponse.json({ candidate: data })
}
