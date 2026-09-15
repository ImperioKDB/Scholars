import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { assertAdmin } from '@/lib/admin/guard'
import { checkRateLimit } from '@/lib/ratelimit'
import { z } from 'zod'

const bodySchema = z.object({ experiment_id: z.string().uuid() })
const ENROLLMENT_CAP = 1000

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-reengagement-enroll', limit: 5 })
  if (limited) return limited
  const authClient = await createClient()
  const guard = await assertAdmin(authClient)
  if (!guard.ok) return guard.response

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'experiment_id must be a UUID' }, { status: 400 })

  const service = createServiceClient()
  const { data: experiment, error: experimentError } = await service
    .from('reengagement_experiments')
    .select('id,status,starts_at,ends_at')
    .eq('id', parsed.data.experiment_id)
    .maybeSingle()
  if (experimentError) return NextResponse.json({ error: experimentError.message }, { status: 500 })
  if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
  if (experiment.status !== 'active') return NextResponse.json({ error: 'Only active experiments can be enrolled' }, { status: 409 })
  const now = Date.now()
  if (experiment.starts_at && Date.parse(experiment.starts_at) > now) return NextResponse.json({ error: 'Experiment has not started' }, { status: 409 })
  if (experiment.ends_at && Date.parse(experiment.ends_at) <= now) return NextResponse.json({ error: 'Experiment has ended' }, { status: 409 })

  const { data: assignments, error: assignmentError } = await service
    .from('reengagement_assignments')
    .select('id,profile_id,email_allowed,assignment_group')
    .eq('experiment_id', experiment.id)
    .eq('assignment_group', 'treatment')
    .eq('email_allowed', true)
    .limit(ENROLLMENT_CAP)
  if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 })

  const scheduleBucket = new Date().toISOString().slice(0, 13)
  const rows = (assignments ?? []).map((assignment) => ({
    profile_id: assignment.profile_id,
    scholarship_id: null,
    campaign_key: 'reengagement_treatment',
    channel: 'email',
    schedule_bucket: scheduleBucket,
    dedupe_key: `reengagement:${experiment.id}:${assignment.id}`,
    template_version: 'reengagement-v1',
    status: 'pending',
  }))
  if (rows.length > 0) {
    const { error: insertError } = await service
      .from('notification_deliveries')
      .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    experiment_id: experiment.id,
    eligible_treatment_assignments: assignments?.length ?? 0,
    queued: rows.length,
    sends_started: false,
  })
}
