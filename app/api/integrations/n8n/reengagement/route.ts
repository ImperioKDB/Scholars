import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/ratelimit'

const bodySchema = z.object({
  action: z.enum(['enroll', 'status']),
  experiment_id: z.string().uuid(),
  request_id: z.string().min(8).max(120).regex(/^[A-Za-z0-9._:-]+$/),
})
const ENROLLMENT_CAP = 1000

function validSecret(request: Request): boolean {
  const expected = process.env.N8N_WEBHOOK_SECRET
  const provided = request.headers.get('x-n8n-webhook-secret')
  if (!expected || !provided) return false
  const left = Buffer.from(expected)
  const right = Buffer.from(provided)
  return left.length === right.length && timingSafeEqual(left, right)
}

async function authorize(request: Request) {
  if (!validSecret(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = await checkRateLimit(request, { route: 'n8n-reengagement', limit: 30 })
  return limited ?? null
}

export async function GET(request: Request) {
  const denied = await authorize(request)
  if (denied) return denied
  const url = new URL(request.url)
  const experimentId = url.searchParams.get('experiment_id')
  if (!experimentId || !z.string().uuid().safeParse(experimentId).success) {
    return NextResponse.json({ error: 'experiment_id must be a UUID' }, { status: 400 })
  }
  const service = createServiceClient()
  const [{ data: experiment, error: experimentError }, summary] = await Promise.all([
    service.from('reengagement_experiments').select('id,name,status,starts_at,ends_at,treatment_ratio,created_at').eq('id', experimentId).maybeSingle(),
    readSummary(service, experimentId),
  ])
  if (experimentError || summary.error) return NextResponse.json({ error: 'Status lookup failed' }, { status: 500 })
  if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
  return NextResponse.json({ ok: true, experiment, summary: summary.value, sends_started: false })
}

export async function POST(request: Request) {
  const denied = await authorize(request)
  if (denied) return denied
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid integration request' }, { status: 400 })

  const service = createServiceClient()
  const { action, experiment_id: experimentId, request_id: requestId } = parsed.data
  const { data: prior } = await service
    .from('n8n_reengagement_runs')
    .select('id,result_status,queued_count,created_at')
    .eq('request_id', requestId)
    .maybeSingle()
  if (prior) return NextResponse.json({ ok: prior.result_status === 'accepted', replay: true, run: prior })

  const { data: experiment, error: experimentError } = await service
    .from('reengagement_experiments')
    .select('id,name,status,starts_at,ends_at,treatment_ratio,created_at')
    .eq('id', experimentId)
    .maybeSingle()
  if (experimentError) return recordFailure(service, experimentId, action, requestId, 'experiment_lookup_failed')
  if (!experiment) return recordFailure(service, experimentId, action, requestId, 'experiment_not_found', 404)

  if (action === 'status') {
    const summary = await readSummary(service, experimentId)
    if (summary.error) return recordFailure(service, experimentId, action, requestId, 'summary_failed')
    const run = await recordRun(service, experimentId, action, requestId, 'accepted', 0)
    return NextResponse.json({ ok: true, experiment, summary: summary.value, run_id: run?.id ?? null })
  }

  const now = Date.now()
  if (experiment.status !== 'active') return recordFailure(service, experimentId, action, requestId, 'experiment_not_active', 409)
  if (experiment.starts_at && Date.parse(experiment.starts_at) > now) return recordFailure(service, experimentId, action, requestId, 'experiment_not_started', 409)
  if (experiment.ends_at && Date.parse(experiment.ends_at) <= now) return recordFailure(service, experimentId, action, requestId, 'experiment_ended', 409)

  const { data: assignments, error: assignmentError } = await service
    .from('reengagement_assignments')
    .select('id,profile_id,email_allowed')
    .eq('experiment_id', experimentId)
    .eq('assignment_group', 'treatment')
    .eq('email_allowed', true)
    .limit(ENROLLMENT_CAP)
  if (assignmentError) return recordFailure(service, experimentId, action, requestId, 'assignment_lookup_failed')

  const scheduleBucket = new Date().toISOString().slice(0, 13)
  const rows = (assignments ?? []).map((assignment) => ({
    profile_id: assignment.profile_id,
    scholarship_id: null,
    campaign_key: 'reengagement_treatment',
    channel: 'email',
    schedule_bucket: scheduleBucket,
    dedupe_key: `reengagement:${experimentId}:${assignment.id}`,
    template_version: 'reengagement-v1',
    status: 'pending',
  }))
  if (rows.length > 0) {
    const { error: insertError } = await service.from('notification_deliveries').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    if (insertError) return recordFailure(service, experimentId, action, requestId, 'outbox_insert_failed')
  }
  const run = await recordRun(service, experimentId, action, requestId, 'accepted', rows.length)
  return NextResponse.json({ ok: true, experiment_id: experimentId, eligible_treatment_assignments: assignments?.length ?? 0, queued: rows.length, sends_started: false, run_id: run?.id ?? null })
}

async function recordFailure(service: ReturnType<typeof createServiceClient>, experimentId: string, action: 'enroll' | 'status', requestId: string, code: string, status = 500) {
  const run = await recordRun(service, experimentId, action, requestId, 'rejected', 0, code)
  return NextResponse.json({ ok: false, error: code, run_id: run?.id ?? null }, { status })
}

async function recordRun(service: ReturnType<typeof createServiceClient>, experimentId: string, action: 'enroll' | 'status', requestId: string, resultStatus: 'accepted' | 'rejected' | 'failed', queuedCount: number, errorCode?: string) {
  const { data } = await service.from('n8n_reengagement_runs').insert({ experiment_id: experimentId, requested_action: action, result_status: resultStatus, queued_count: queuedCount, request_id: requestId, error_code: errorCode ?? null }).select('id').single()
  return data
}

async function readSummary(service: ReturnType<typeof createServiceClient>, experimentId: string) {
  const [{ data: assignments, error: assignmentError }, { data: events, error: eventError }] = await Promise.all([
    service.from('reengagement_assignments').select('id,segment,assignment_group,email_allowed,whatsapp_allowed').eq('experiment_id', experimentId).limit(2000),
    service.from('reengagement_campaign_events').select('assignment_id,event').eq('experiment_id', experimentId).limit(10000),
  ])
  if (assignmentError || eventError) return { error: assignmentError ?? eventError }
  const eventCounts = (events ?? []).reduce<Record<string, number>>((acc, row) => { acc[row.event] = (acc[row.event] ?? 0) + 1; return acc }, {})
  const assignmentCounts = (assignments ?? []).reduce<Record<string, number>>((acc, row) => { const key = `${row.segment}:${row.assignment_group}`; acc[key] = (acc[key] ?? 0) + 1; return acc }, {})
  return { value: { assignment_count: assignments?.length ?? 0, assignment_counts: assignmentCounts, event_counts: eventCounts, email_allowed: (assignments ?? []).filter((row) => row.email_allowed).length, whatsapp_allowed: (assignments ?? []).filter((row) => row.whatsapp_allowed).length } }
}
