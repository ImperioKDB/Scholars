import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { assertAdmin } from '@/lib/admin/guard'
import { checkRateLimit } from '@/lib/ratelimit'
import { z } from 'zod'

const inputSchema = z.object({
  name: z.string().trim().min(3).max(120),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  treatment_ratio: z.number().min(0.01).max(0.99).default(0.8),
})

const PROFILE_CAP = 1000

type Profile = {
  id: string
  profile_completeness: number | null
  whatsapp_opt_in: boolean | null
  last_seen_at: string | null
}

type Activity = { profile_id: string; event: string; created_at: string }
type AssignmentRow = {
  profile_id: string
  segment: string
  assignment_group: string
  email_allowed: boolean
  whatsapp_allowed: boolean
  deep_link: string
  next_action: string
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-reengagement', limit: 10 })
  if (limited) return limited
  const authClient = await createClient()
  const guard = await assertAdmin(authClient)
  if (!guard.ok) return guard.response

  const parsed = inputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid experiment details', issues: parsed.error.issues }, { status: 400 })

  const service = createServiceClient()
  const { data: existing, error: existingError } = await service
    .from('reengagement_experiments')
    .select('id,status')
    .eq('name', parsed.data.name)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (existing) return NextResponse.json({ error: 'An experiment with this name already exists' }, { status: 409 })

  const [{ data: profiles, error: profileError }, { data: activity, error: activityError }, { data: saved, error: savedError }, { data: applications, error: applicationError }] = await Promise.all([
    service.from('profiles').select('id,profile_completeness,whatsapp_opt_in,last_seen_at').order('created_at', { ascending: true }).limit(PROFILE_CAP),
    service.from('events').select('profile_id,event,created_at').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()).limit(10000),
    service.from('saved_scholarships').select('profile_id').limit(10000),
    service.from('applications').select('profile_id').limit(10000),
  ])
  const queryError = profileError ?? activityError ?? savedError ?? applicationError
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 })

  const authUserIds = new Set<string>()
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const user of data.users) {
      if (user.id && user.email) authUserIds.add(user.id)
    }
    if (data.users.length < 100) break
  }

  const activeEvents = new Set(['profile_completed', 'match_viewed', 'scholarship_saved', 'application_started', 'provider_clicked', 'application_status_changed'])
  const activeByProfile = new Set((activity as Activity[] ?? []).filter((row) => activeEvents.has(row.event)).map((row) => row.profile_id))
  const savedByProfile = new Set((saved ?? []).map((row) => row.profile_id))
  const applicationByProfile = new Set((applications ?? []).map((row) => row.profile_id))
  const assignmentRows: AssignmentRow[] = []

  for (const profile of profiles as Profile[] ?? []) {
    const isUnreachable = !authUserIds.has(profile.id)
    const hasSavedOrApplication = savedByProfile.has(profile.id) || applicationByProfile.has(profile.id)
    const isIncomplete = (profile.profile_completeness ?? 0) < 100
    const isInactive = !activeByProfile.has(profile.id) && (!profile.last_seen_at || Date.parse(profile.last_seen_at) < Date.now() - 14 * 86400000)
    const segment = isUnreachable
      ? 'unreachable'
      : hasSavedOrApplication
        ? 'saved_or_application_started'
        : isIncomplete
          ? 'incomplete_onboarding'
          : isInactive
            ? 'onboarded_inactive'
            : null
    if (!segment) continue

    const bucket = stableBucket(profile.id + ':' + parsed.data.name)
    const assignmentGroup = bucket < parsed.data.treatment_ratio ? 'treatment' : 'holdout'
    const emailAllowed = authUserIds.has(profile.id)
    const whatsappAllowed = Boolean(profile.whatsapp_opt_in)
    const deepLink = segment === 'incomplete_onboarding'
      ? '/onboarding'
      : segment === 'saved_or_application_started'
        ? '/applications'
        : '/dashboard'
    const nextAction = segment === 'incomplete_onboarding'
      ? 'Complete your profile to unlock better matches'
      : segment === 'saved_or_application_started'
        ? 'Continue your saved opportunity or application'
        : 'Return to view opportunities matched to you'
    assignmentRows.push({ profile_id: profile.id, segment, assignment_group: assignmentGroup, email_allowed: emailAllowed, whatsapp_allowed: whatsappAllowed, deep_link: deepLink, next_action: nextAction })
  }

  const { data: experiment, error: experimentError } = await service
    .from('reengagement_experiments')
    .insert({ name: parsed.data.name, treatment_ratio: parsed.data.treatment_ratio, starts_at: parsed.data.starts_at ?? null, ends_at: parsed.data.ends_at ?? null, created_by: guard.userId })
    .select('id,name,status,treatment_ratio,starts_at,ends_at,created_at')
    .single()
  if (experimentError) return NextResponse.json({ error: experimentError.message }, { status: 500 })

  const rows = assignmentRows.map((row) => ({ ...row, experiment_id: experiment.id }))
  if (rows.length > 0) {
    const { error: assignmentError } = await service.from('reengagement_assignments').insert(rows)
    if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 })
  }

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = `${row.segment}:${row.assignment_group}`
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  return NextResponse.json({ experiment, assignment_count: rows.length, counts, sends_started: false })
}

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-reengagement', limit: 30 })
  if (limited) return limited
  const authClient = await createClient()
  const guard = await assertAdmin(authClient)
  if (!guard.ok) return guard.response
  const service = createServiceClient()
  const { data, error } = await service.from('reengagement_experiments').select('id,name,status,treatment_ratio,starts_at,ends_at,created_at').order('created_at', { ascending: false }).limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ experiments: data ?? [] })
}

function stableBucket(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}
