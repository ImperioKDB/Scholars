import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

function authorized(request: Request) { const secret = process.env.CRON_SECRET; return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`) }
const enqueueSchema = z.object({ action: z.literal('enqueue'), candidate_ids: z.array(z.string().uuid()).min(1).max(100), job_key: z.string().trim().min(8).max(200) })
const completeSchema = z.object({ action: z.literal('complete'), job_id: z.string().uuid(), success: z.boolean(), result: z.record(z.unknown()).optional(), error: z.record(z.unknown()).optional() })

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const leaseUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const { data, error } = await service.rpc('claim_workflow_job', { p_kind: 'discovery_verification', p_lease_until: leaseUntil })
  if (error) return NextResponse.json({ error: 'Could not claim discovery job' }, { status: 500 })
  const job = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ job: job ?? null })
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const raw = await request.json().catch(() => null)
  const action = raw && typeof raw === 'object' && 'action' in raw ? raw.action : null
  const service = createServiceClient()
  if (action === 'enqueue') {
    const parsed = enqueueSchema.safeParse(raw)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid enqueue request' }, { status: 400 })
    const { data, error } = await service.from('workflow_jobs').upsert({ kind: 'discovery_verification', idempotency_key: parsed.data.job_key, payload: { candidate_ids: parsed.data.candidate_ids }, status: 'pending', available_at: new Date().toISOString() }, { onConflict: 'idempotency_key', ignoreDuplicates: true }).select('id,status,idempotency_key').maybeSingle()
    if (error) return NextResponse.json({ error: 'Could not enqueue discovery job' }, { status: 500 })
    return NextResponse.json({ ok: true, job: data })
  }
  const parsed = completeSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid completion request' }, { status: 400 })
  const retryAt = parsed.data.success ? null : new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const { data, error } = await service.rpc('complete_workflow_job', { p_job_id: parsed.data.job_id, p_success: parsed.data.success, p_result: parsed.data.result ?? null, p_error: parsed.data.error ?? null, p_retry_at: retryAt })
  if (error) return NextResponse.json({ error: 'Could not complete discovery job' }, { status: 500 })
  return NextResponse.json({ ok: true, job: data })
}
