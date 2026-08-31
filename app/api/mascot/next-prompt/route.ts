// app/api/mascot/next-prompt/route.ts
// GET /api/mascot/next-prompt
//
// Returns the single highest-priority thing Ade (the onboarding mascot)
// should ask the student about right now, or { prompt: null } if there's
// nothing pending. Priority order:
//   1. An application whose provider-site link was clicked but hasn't been
//      followed up on yet (or was clicked again since the last check-in).
//   2. An application whose deadline has passed and is still "in_progress"
//      with no in-app check-in shown yet.
// Deliberately returns at most one prompt -- Ade asks one thing at a time,
// never stacks questions. The "track this before you go" nudge is NOT
// handled here -- that one is purely client-side (see
// components/ade/AdeProvider.tsx's confirmApply), since it depends on
// which scholarship is on screen right now, not on stored state.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ prompt: null })
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const nowIso = new Date().toISOString()

  // Priority 1: clicked the apply link, never checked in since (or clicked
  // again after the last check-in was shown).
  const { data: clicked } = await supabase
    .from('applications')
    .select(
      'id, link_clicked_at, checkin_prompted_at, checkin_snoozed_until, scholarship:scholarships ( id, title )'
    )
    .eq('profile_id', user.id)
    .eq('status', 'in_progress')
    .not('link_clicked_at', 'is', null)
    .or(`checkin_snoozed_until.is.null,checkin_snoozed_until.lt.${nowIso}`)
    .order('link_clicked_at', { ascending: false })
    .limit(5)

  const clickedRows = (clicked ?? []) as unknown as {
    id: string
    link_clicked_at: string
    checkin_prompted_at: string | null
    scholarship: { id: string; title: string } | null
  }[]

  const clickedMatch = clickedRows.find(
    (row) => row.scholarship && (!row.checkin_prompted_at || row.checkin_prompted_at < row.link_clicked_at)
  )

  if (clickedMatch && clickedMatch.scholarship) {
    return NextResponse.json({
      prompt: {
        applicationId: clickedMatch.id,
        scholarshipId: clickedMatch.scholarship.id,
        scholarshipTitle: clickedMatch.scholarship.title,
        reason: 'clicked',
      },
    })
  }

  // Priority 2: deadline passed, still in_progress, never asked in-app yet.
  // `!inner` is required -- without it a non-matching deadline nulls the
  // embedded scholarship instead of dropping the row (same reasoning as
  // the cron job's join). Sorted in JS rather than via `.order()` on an
  // embedded column to avoid relying on untested foreign-table ordering
  // syntax for a query this small.
  const { data: overdue } = await supabase
    .from('applications')
    .select(
      'id, checkin_prompted_at, checkin_snoozed_until, scholarships!inner ( id, title, deadline )'
    )
    .eq('profile_id', user.id)
    .eq('status', 'in_progress')
    .is('checkin_prompted_at', null)
    .or(`checkin_snoozed_until.is.null,checkin_snoozed_until.lt.${nowIso}`)
    .lt('scholarships.deadline', todayStr)

  const overdueRows = (overdue ?? []) as unknown as {
    id: string
    scholarships: { id: string; title: string; deadline: string }
  }[]

  const overdueMatch = overdueRows.sort((a, b) =>
    a.scholarships.deadline < b.scholarships.deadline ? -1 : 1
  )[0]

  if (overdueMatch) {
    return NextResponse.json({
      prompt: {
        applicationId: overdueMatch.id,
        scholarshipId: overdueMatch.scholarships.id,
        scholarshipTitle: overdueMatch.scholarships.title,
        reason: 'deadline_passed',
      },
    })
  }

  return NextResponse.json({ prompt: null })
}
