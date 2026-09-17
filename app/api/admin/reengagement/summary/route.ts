import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { assertAdmin } from '@/lib/admin/guard'
import { checkRateLimit } from '@/lib/ratelimit'

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-reengagement-summary', limit: 30 })
  if (limited) return limited
  const authClient = await createClient()
  const guard = await assertAdmin(authClient)
  if (!guard.ok) return guard.response

  const id = new URL(request.url).searchParams.get('experiment_id')
  if (!id) return NextResponse.json({ error: 'experiment_id is required' }, { status: 400 })

  const service = createServiceClient()
  const [{ data: experiment, error: experimentError }, { data: assignments, error: assignmentError }, { data: events, error: eventError }] = await Promise.all([
    service.from('reengagement_experiments').select('id,name,status,treatment_ratio,starts_at,ends_at,created_at').eq('id', id).maybeSingle(),
    service.from('reengagement_assignments').select('id,segment,assignment_group,email_allowed,whatsapp_allowed').eq('experiment_id', id).limit(2000),
    service.from('reengagement_campaign_events').select('assignment_id,event,created_at').eq('experiment_id', id).limit(10000),
  ])
  const error = experimentError ?? assignmentError ?? eventError
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })

  const assignmentCounts = (assignments ?? []).reduce<Record<string, number>>((acc, row) => {
    const key = `${row.segment}:${row.assignment_group}`
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const eventCounts = (events ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.event] = (acc[row.event] ?? 0) + 1
    return acc
  }, {})
  const clickedAssignments = new Set((events ?? []).filter((row) => row.event === 'clicked').map((row) => row.assignment_id))
  const treatment = (assignments ?? []).filter((row) => row.assignment_group === 'treatment')
  const holdout = (assignments ?? []).filter((row) => row.assignment_group === 'holdout')

  return NextResponse.json({
    experiment,
    assignment_count: assignments?.length ?? 0,
    assignment_counts: assignmentCounts,
    channel_eligibility: {
      email_allowed: (assignments ?? []).filter((row) => row.email_allowed).length,
      whatsapp_allowed: (assignments ?? []).filter((row) => row.whatsapp_allowed).length,
    },
    event_counts: eventCounts,
    click_through: {
      treatment_assigned: treatment.length,
      treatment_clicked: treatment.filter((row) => clickedAssignments.has(row.id)).length,
      holdout_assigned: holdout.length,
      clicked_assignments: clickedAssignments.size,
    },
    sends_started: false,
  })
}
