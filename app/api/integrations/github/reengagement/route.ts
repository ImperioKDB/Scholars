import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/ratelimit'
import { z } from 'zod'

const bodySchema = z.object({
  experiment_id: z.string().uuid(),
  request_id: z.string().min(8).max(120).regex(/^[A-Za-z0-9._:-]+$/),
})
const ENROLLMENT_CAP = 1000

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  return Boolean(expected && header === `Bearer ${expected}`)
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = await checkRateLimit(request, { route: 'github-reengagement', limit: 10 })
  if (limited) return limited
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid automation request' }, { status: 400 })

  const service = createServiceClient()
  const { experiment_id: experimentId, request_id: requestId } = parsed.data
  const { data: existing } = await service.from('workflow_jobs').select('id,status,result_metadata').eq('idempotency_key', `github-reengagement:${requestId}`).maybeSingle()
  if (existing) return NextResponse.json({ ok: existing.status !== 'failed', replay: true, job: existing })

  const { data: job, error: jobError } = await service.from('workflow_jobs').insert({ kind: 'reengagement_enrollment', idempotency_key: `github-reengagement:${requestId}`, status: 'pending', payload: { experiment_id: experimentId } }).select('id').single()
  if (jobError) return NextResponse.json({ error: 'Could not create automation job' }, { status: 500 })

  const fail = async (code: string, status: number) => {
    await service.from('workflow_jobs').update({ status: 'dead_letter', result_metadata: { error: code }, completed_at: new Date().toISOString() }).eq('id', job.id)
    return NextResponse.json({ ok: false, error: code, job_id: job.id }, { status })
  }

  const { data: experiment, error: experimentError } = await service.from('reengagement_experiments').select('id,status,starts_at,ends_at').eq('id', experimentId).maybeSingle()
  if (experimentError) return fail('experiment_lookup_failed', 500)
  if (!experiment) return fail('experiment_not_found', 404)
  const now = Date.now()
  if (experiment.status !== 'active') return fail('experiment_not_active', 409)
  if (experiment.starts_at && Date.parse(experiment.starts_at) > now) return fail('experiment_not_started', 409)
  if (experiment.ends_at && Date.parse(experiment.ends_at) <= now) return fail('experiment_ended', 409)

  const { data: assignments, error: assignmentError } = await service.from('reengagement_assignments').select('id,profile_id,email_allowed').eq('experiment_id', experimentId).eq('assignment_group', 'treatment').eq('email_allowed', true).limit(ENROLLMENT_CAP)
  if (assignmentError) return fail('assignment_lookup_failed', 500)
  const scheduleBucket = new Date().toISOString().slice(0, 13)
  const rows = (assignments ?? []).map((assignment) => ({ profile_id: assignment.profile_id, scholarship_id: null, campaign_key: 'reengagement_treatment', channel: 'email', schedule_bucket: scheduleBucket, dedupe_key: `reengagement:${experimentId}:${assignment.id}`, template_version: 'reengagement-v1', status: 'pending' }))
  if (rows.length > 0) {
    const { error: insertError } = await service.from('notification_deliveries').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    if (insertError) return fail('outbox_insert_failed', 500)
  }
  await service.from('workflow_jobs').update({ status: 'succeeded', result_metadata: { queued: rows.length, sends_started: false }, completed_at: new Date().toISOString() }).eq('id', job.id)
  return NextResponse.json({ ok: true, experiment_id: experimentId, eligible_treatment_assignments: assignments?.length ?? 0, queued: rows.length, sends_started: false, job_id: job.id })
}
