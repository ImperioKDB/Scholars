// app/api/applications/[id]/draft/route.ts
// POST  /api/applications/[id]/draft -- (re)generate a draft: AI personal
//       statement + deterministic summary/checklist from the profile.
//       Regenerating always clears any prior confirmation.
// PATCH /api/applications/[id]/draft -- edit the statement text and/or
//       confirm the draft. Editing without confirm=true clears any prior
//       confirmation, since confirmed content and edited content must not
//       silently diverge.
//
// AUTO-APPLY SCOPE: this never submits anything to a third-party portal.
// There's no reliable, safe way to automate arbitrary scholarship
// application forms across dozens of different providers. Confirming a
// draft here means "this is what I'll use" -- the student copies it into
// the scholarship's own application_url.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { buildDraftSummary, buildStatementPrompt, generateStatement } from '@/lib/applications/draft'
import { evaluateScholarship } from '@/lib/matching/engine'
import type { MatchableProfile } from '@/lib/matching/types'

const PROFILE_COLUMNS =
  'full_name, discipline, gpa, nationality, gender, financial_need, career_goals, date_of_birth, state_of_origin, lga_of_origin, year_of_study, institution_name, institution_type, jamb_score, waec_credit_count, has_english_maths_credit, disability_status, has_valid_id, has_transcript, has_recommendation_letter, has_personal_statement, has_lga_certificate, profile_completeness'

const DRAFT_COLUMNS = 'id, draft_statement, draft_summary, draft_generated_at, draft_confirmed_at'

type LoadedScholarship = {
  id: string
  title: string
  provider_name: string
  description: string | null
  amount: string | null
  discipline: string | null
}

async function loadContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
  userId: string
): Promise<
  | { error: 'not_found' | 'profile_not_found' }
  | {
      error: null
      scholarship: LoadedScholarship
      profile: Record<string, unknown>
      waecResults: { subject: string; grade: string }[]
      rules: { id: string; scholarship_id: string; field: string; operator: 'eq' | 'gte' | 'lte' | 'in' | 'exists'; value: unknown }[]
    }
> {
  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('id, profile_id, scholarship:scholarships ( id, title, provider_name, description, amount, discipline )')
    .eq('id', applicationId)
    .eq('profile_id', userId)
    .single()

  if (appError || !application) return { error: 'not_found' }

  const scholarship = application.scholarship as unknown as LoadedScholarship

  const [{ data: profile, error: profileError }, { data: waecResults }, { data: rules }] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single(),
    supabase.from('waec_results').select('subject, grade').eq('profile_id', userId).order('subject', { ascending: true }),
    supabase
      .from('scholarship_rules')
      .select('id, scholarship_id, field, operator, value')
      .eq('scholarship_id', scholarship.id),
  ])

  if (profileError || !profile) return { error: 'profile_not_found' }

  return {
    error: null,
    scholarship,
    profile: profile as Record<string, unknown>,
    waecResults: waecResults ?? [],
    rules: (rules ?? []) as {
      id: string
      scholarship_id: string
      field: string
      operator: 'eq' | 'gte' | 'lte' | 'in' | 'exists'
      value: unknown
    }[],
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const context = await loadContext(supabase, id, user.id)
  if (context.error) {
    if (context.error === 'not_found') {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Complete your profile before generating a draft' }, { status: 400 })
  }

  const { scholarship, profile, waecResults, rules } = context
  const p = profile as unknown as Record<string, never>

  const matchableProfile: MatchableProfile = {
    discipline: (profile.discipline as string | null) ?? null,
    gpa: (profile.gpa as number | null) ?? null,
    nationality: (profile.nationality as string | null) ?? null,
    gender: (profile.gender as string | null) ?? null,
    financial_need: Boolean(profile.financial_need),
    date_of_birth: (profile.date_of_birth as string | null) ?? null,
    state_of_origin: (profile.state_of_origin as string | null) ?? null,
    lga_of_origin: (profile.lga_of_origin as string | null) ?? null,
    year_of_study: (profile.year_of_study as number | null) ?? null,
    institution_type: (profile.institution_type as MatchableProfile['institution_type']) ?? null,
    jamb_score: (profile.jamb_score as number | null) ?? null,
    waec_credit_count: (profile.waec_credit_count as number | null) ?? null,
    has_english_maths_credit: Boolean(profile.has_english_maths_credit),
    disability_status: Boolean(profile.disability_status),
    profile_completeness: (profile.profile_completeness as number) ?? 0,
  }

  const evaluated = evaluateScholarship(
    matchableProfile,
    {
      id: scholarship.id,
      title: scholarship.title,
      provider_name: scholarship.provider_name,
      description: scholarship.description,
      amount: scholarship.amount,
      deadline: null,
      application_url: null,
      // Not loaded/needed for draft generation -- this route only uses
      // the evaluation's requirement labels, never renders an apply
      // action. Added to satisfy ScholarshipRow's how_to_apply field
      // (see migration: add_how_to_apply_fallback).
      how_to_apply: null,
      level: 'undergrad',
      discipline: scholarship.discipline,
      verified: true,
    },
    rules
  )

  const metLabels = evaluated.requirements.filter((r) => r.status === 'met').map((r) => r.requirement)

  const summary = buildDraftSummary(p as never, waecResults)
  const prompt = buildStatementPrompt(p as never, scholarship, metLabels)

  let statement: string
  try {
    statement = await generateStatement(prompt)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to generate draft' }, { status: 502 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('applications')
    .update({
      draft_statement: statement,
      draft_summary: summary,
      draft_generated_at: new Date().toISOString(),
      draft_confirmed_at: null,
    })
    .eq('id', id)
    .eq('profile_id', user.id)
    .select(DRAFT_COLUMNS)
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ draft: updated })
}

const patchSchema = z
  .object({
    draft_statement: z.string().trim().min(1).max(6000),
    confirm: z.boolean(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, 'No fields to update')

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 })
  }

  const update: { draft_statement?: string; draft_confirmed_at?: string | null } = {}
  if (parsed.data.draft_statement !== undefined) {
    update.draft_statement = parsed.data.draft_statement
  }
  if (parsed.data.confirm === true) {
    update.draft_confirmed_at = new Date().toISOString()
  } else if (parsed.data.draft_statement !== undefined) {
    // Editing the text without explicitly confirming invalidates any
    // earlier confirmation -- confirmed and edited content must not diverge.
    update.draft_confirmed_at = null
  }

  const { data, error } = await supabase
    .from('applications')
    .update(update)
    .eq('id', id)
    .eq('profile_id', user.id)
    .select(DRAFT_COLUMNS)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ draft: data })
}
