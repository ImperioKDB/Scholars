// app/api/profile/waec/route.ts
// GET  /api/profile/waec  -- list the current user's WAEC subject/grade results
// POST /api/profile/waec  -- bulk replace the current user's WAEC results
//
// Unlike the admin scholarship_rules API (deliberately add-one/delete-one --
// see app/api/admin/scholarships/[id]/rules/route.ts -- to keep each write
// small and auditable), this list is small, owned entirely by one user, and
// edited as a whole screen at once. A delete-all-then-insert bulk replace is
// simpler here and doesn't carry the same audit-trail concerns as
// admin-authored eligibility rules. Flagging the deliberate deviation.
//
// profiles.waec_credit_count and profiles.has_english_maths_credit are NOT
// touched here directly -- they're recomputed by the sync_waec_summary_fields()
// Postgres trigger on waec_results (migration: add_waec_results_table)
// whenever this table changes, the same way profile_completeness is
// trigger-computed rather than accepted from the client.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { WAEC_SUBJECTS, WAEC_GRADES } from '@/lib/data/waec'

const subjectValues = WAEC_SUBJECTS as unknown as [string, ...string[]]
const gradeValues = WAEC_GRADES.map((g) => g.value) as [string, ...string[]]

const resultSchema = z.object({
  subject: z.enum(subjectValues),
  grade: z.enum(gradeValues),
})

const bodySchema = z.object({
  results: z.array(resultSchema).max(WAEC_SUBJECTS.length),
})

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: results, error } = await supabase
    .from('waec_results')
    .select('subject, grade')
    .eq('profile_id', user.id)
    .order('subject', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ results })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid WAEC data', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // De-dupe by subject -- a student shouldn't have two grades for one subject.
  const bySubject = new Map(parsed.data.results.map((r) => [r.subject, r.grade]))
  const rows = Array.from(bySubject.entries()).map(([subject, grade]) => ({
    profile_id: user.id,
    subject,
    grade,
  }))

  const { error: deleteError } = await supabase
    .from('waec_results')
    .delete()
    .eq('profile_id', user.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('waec_results').insert(rows)
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    results: rows.map(({ subject, grade }) => ({ subject, grade })),
  })
}
