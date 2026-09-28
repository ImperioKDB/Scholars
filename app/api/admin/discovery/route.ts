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
  const [{ data: sources, error: sourcesError }, { data: candidates, error: candidatesError }, { data: claims, error: claimsError }] = await Promise.all([
    supabase.from('discovery_sources').select('id,name,base_url,source_type,trust_tier,enabled,pilot_enabled,crawl_policy,last_crawled_at').order('name').limit(50),
    supabase.from('scholarship_discovery_candidates').select('id,source_id,source_url,application_url,title,provider_name,description,amount,deadline,level,discipline,eligibility_notes,evidence_excerpt,fetched_at,confidence,status,rejection_reason,reviewed_at,published_scholarship_id,published_at,duplicate_of,duplicate_score,duplicate_reason,verification_status,verification_http_status,verification_final_url,verification_notes,last_verified_at,freshness_status,last_verified_content_hash,stale_after,material_change_detected_at,extraction_status,extractor_version,extraction_input_hash,quality_status,quality_score,quality_issues,quality_scored_at,eligibility_review_status,eligibility_verdict,eligibility_confidence,eligibility_report,eligibility_reviewed_at,eligibility_review_error,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('scholarship_discovery_candidate_claims').select('id,candidate_id,field,value_json,operator,source_url,evidence_quote,confidence,extraction_method,extractor_version,review_status,reviewed_at').order('created_at', { ascending: false }).limit(1000),
  ])
  if (sourcesError || candidatesError || claimsError) return NextResponse.json({ error: 'Could not load discovery data' }, { status: 500 })
  const claimsByCandidate = new Map<string, unknown[]>()
  for (const claim of claims ?? []) claimsByCandidate.set(claim.candidate_id, [...(claimsByCandidate.get(claim.candidate_id) ?? []), claim])
  return NextResponse.json({ sources: sources ?? [], candidates: (candidates ?? []).map((candidate) => ({ ...candidate, claims: claimsByCandidate.get(candidate.id) ?? [] })) })
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
    const { data, error } = await supabase.rpc('publish_discovery_candidate', { candidate_id: candidateId })
    if (error) {
      const statusCode = error.code === 'P0002' ? 404 : error.code === '22023' ? 409 : error.code === '42501' ? 403 : 500
      return NextResponse.json({ error: statusCode === 500 ? 'Could not publish candidate to catalogue' : error.message }, { status: statusCode })
    }
    return NextResponse.json({ candidate: data, scholarship_id: data?.scholarship_id })
  }
  const { data, error } = await supabase.from('scholarship_discovery_candidates').update({ status, rejection_reason: rejectionReason ?? null, reviewed_by: guard.userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', candidateId).select('id,status,reviewed_at').single()
  if (error) return NextResponse.json({ error: 'Could not update candidate' }, { status: 500 })
  return NextResponse.json({ candidate: data })
}
