import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { assertAdmin } from '@/lib/admin/guard'
import { checkRateLimit } from '@/lib/ratelimit'

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-discovery-operations', limit: 60 })
  if (limited) return limited
  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response
  const service = createServiceClient()
  const [{ data: jobs, error: jobsError }, { data: candidates, error: candidatesError }] = await Promise.all([
    service.from('workflow_jobs').select('id,kind,status,attempts,available_at,lease_until,last_error,result_metadata,created_at,completed_at').in('kind', ['discovery_verification']).order('created_at', { ascending: false }).limit(100),
    service.from('scholarship_discovery_candidates').select('id,status,verification_status,freshness_status,created_at,last_verified_at').order('created_at', { ascending: false }).limit(500),
  ])
  if (jobsError || candidatesError) return NextResponse.json({ error: 'Could not load discovery operations' }, { status: 500 })
  const counts = (jobs ?? []).reduce<Record<string, number>>((summary, job) => { summary[job.status] = (summary[job.status] ?? 0) + 1; return summary }, {})
  const candidateCounts = (candidates ?? []).reduce<Record<string, number>>((summary, candidate) => { const key = `${candidate.status}:${candidate.freshness_status}`; summary[key] = (summary[key] ?? 0) + 1; return summary }, {})
  const oldestOpenJob = (jobs ?? []).filter((job) => ['pending', 'retryable', 'leased'].includes(job.status)).at(-1)?.created_at ?? null
  return NextResponse.json({ generated_at: new Date().toISOString(), jobs: { counts, oldest_open_job: oldestOpenJob, recent: jobs ?? [] }, candidates: { counts: candidateCounts, sampled: candidates?.length ?? 0 } })
}
