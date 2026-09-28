import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '@/lib/admin/guard'
import { checkRateLimit } from '@/lib/ratelimit'

const schema = z.object({
  claim_id: z.string().uuid(),
  review_status: z.enum(['confirmed', 'rejected']),
  rejection_reason: z.string().trim().max(1000).optional().nullable(),
})

export async function PATCH(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-discovery-claims', limit: 120 })
  if (limited) return limited
  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid claim review' }, { status: 400 })
  const { claim_id: claimId, review_status: reviewStatus, rejection_reason: rejectionReason } = parsed.data
  const { data: claim, error: claimError } = await supabase.from('scholarship_discovery_candidate_claims').select('id,candidate_id,field,value_json,review_status').eq('id', claimId).single()
  if (claimError || !claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('scholarship_discovery_candidate_claims').update({ review_status: reviewStatus, reviewed_by: guard.userId, reviewed_at: now, rejection_reason: reviewStatus === 'rejected' ? rejectionReason ?? 'Rejected during admin review' : null }).eq('id', claimId).select('id,candidate_id,field,value_json,operator,review_status,reviewed_at,rejection_reason').single()
  if (error) return NextResponse.json({ error: 'Could not update claim' }, { status: 500 })
  const { error: eventError } = await supabase.from('scholarship_discovery_review_events').insert({ candidate_id: claim.candidate_id, claim_id: claim.id, actor_id: guard.userId, event_type: reviewStatus === 'confirmed' ? 'claim_confirmed' : 'claim_rejected', previous_value: { review_status: claim.review_status }, new_value: { review_status: reviewStatus, field: claim.field, value: claim.value_json }, notes: rejectionReason ?? null })
  if (eventError) return NextResponse.json({ error: 'Claim updated but audit event failed' }, { status: 500 })
  return NextResponse.json({ claim: data })
}
