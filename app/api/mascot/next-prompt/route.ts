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
//   3. An achievement unlocked but not yet announced.
// Deliberately returns at most one prompt -- Ade asks one thing at a time,
// never stacks questions.
//
// REFACTOR BATCH 1: rate-limit parity (30/min per IP). Ade polls on every
// window focus event, so a student with many tabs open (or a script) could
// otherwise hammer this endpoint far past normal usage.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: 'mascot-next-prompt', limit: 30 })
  if (limited) return limited
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
  const { data: clicked } = await supabase
    .from('applications')
    .select(
      'id, link_clicked_at, checkin_prompted_at, checkin_snoozed_until, scholarship:scholarships ( id, title ), opportunity:opportunities ( id, title )'
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
    opportunity: { id: string; title: string } | null
  }[]
  const clickedMatch = clickedRows.find(
    (row) => (row.scholarship || row.opportunity) && (!row.checkin_prompted_at || row.checkin_prompted_at < row.link_clicked_at)
  )
  if (clickedMatch) {
    const listing = clickedMatch.scholarship ?? clickedMatch.opportunity
    if (listing) return NextResponse.json({ prompt: { type: 'checkin', applicationId: clickedMatch.id, listingKind: clickedMatch.scholarship ? 'scholarship' : 'opportunity', listingId: listing.id, listingTitle: listing.title, scholarshipId: clickedMatch.scholarship?.id ?? null, scholarshipTitle: clickedMatch.scholarship?.title ?? null, reason: 'clicked' } })
  }
  const { data: overdue } = await supabase
    .from('applications')
    .select(
      'id, checkin_prompted_at, checkin_snoozed_until, scholarships ( id, title, deadline ), opportunities ( id, title, deadline )'
    )
    .eq('profile_id', user.id)
    .eq('status', 'in_progress')
    .is('checkin_prompted_at', null)
    .or(`checkin_snoozed_until.is.null,checkin_snoozed_until.lt.${nowIso}`)
.or(`scholarships.deadline.lt.${todayStr},opportunities.deadline.lt.${todayStr}`)
  const overdueRows = (overdue ?? []) as unknown as {
    id: string
    scholarships: { id: string; title: string; deadline: string } | null
    opportunities: { id: string; title: string; deadline: string } | null
  }[]
  const overdueMatch = overdueRows.filter((row) => row.scholarships || row.opportunities).sort((a, b) => {
    const ad = (a.scholarships ?? a.opportunities)!.deadline
    const bd = (b.scholarships ?? b.opportunities)!.deadline
    return ad < bd ? -1 : 1
  })[0]
  if (overdueMatch) {
    const listing = overdueMatch.scholarships ?? overdueMatch.opportunities
    if (listing) return NextResponse.json({ prompt: { type: 'checkin', applicationId: overdueMatch.id, listingKind: overdueMatch.scholarships ? 'scholarship' : 'opportunity', listingId: listing.id, listingTitle: listing.title, scholarshipId: overdueMatch.scholarships?.id ?? null, scholarshipTitle: overdueMatch.scholarships?.title ?? null, reason: 'deadline_passed' } })
  }
  const { data: achievementRow } = await supabase
    .from('user_achievements')
    .select('achievement_id, unlocked_at, achievements ( label, description, xp_reward, tier )')
    .eq('profile_id', user.id)
    .is('announced_at', null)
    .order('unlocked_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (achievementRow && achievementRow.achievements) {
    const a = achievementRow.achievements as unknown as {
      label: string
      description: string
      xp_reward: number
      tier: string
    }
    return NextResponse.json({
      prompt: {
        type: 'achievement',
        achievementId: achievementRow.achievement_id,
        label: a.label,
        description: a.description,
        xpReward: a.xp_reward,
        tier: a.tier,
      },
    })
  }
  return NextResponse.json({ prompt: null })
}
