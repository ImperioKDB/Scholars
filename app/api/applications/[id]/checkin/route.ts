// app/api/applications/[id]/checkin/route.ts
// POST /api/applications/[id]/checkin
//
// Answers or snoozes Ade's (the mascot) check-in question for one
// application.
//   { action: "answer", status } -- sets the real application status
//     (submitted/accepted/rejected/in_progress) and stamps
//     checkin_prompted_at so the same question doesn't resurface.
//   { action: "snooze" } -- suppresses this application's check-in for 3
//     days without changing its status. "Ask me later," not "never."
//   { action: "not_open_yet" } -- the scholarship's own application portal
//     isn't open yet, so there's nothing to report. Deliberately NOT a
//     status write -- the student is still in_progress, just blocked on
//     the provider. Modeled as a longer snooze (14 days) instead, so it
//     doesn't corrupt StatusDonut counts or the cron's overdue-checkin
//     query, both of which key off `status`.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const STATUS_VALUES = ['in_progress', 'submitted', 'accepted', 'rejected'] as const
const SNOOZE_DAYS = 3
const NOT_OPEN_SNOOZE_DAYS = 14

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('answer'), status: z.enum(STATUS_VALUES) }),
  z.object({ action: z.literal('snooze') }),
  z.object({ action: z.literal('not_open_yet') }),
])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 })
  }

  const now = new Date()
  const update: Record<string, unknown> = { checkin_prompted_at: now.toISOString() }

  if (parsed.data.action === 'answer') {
    update.status = parsed.data.status
  } else if (parsed.data.action === 'not_open_yet') {
    const snoozeUntil = new Date(now)
    snoozeUntil.setDate(snoozeUntil.getDate() + NOT_OPEN_SNOOZE_DAYS)
    update.checkin_snoozed_until = snoozeUntil.toISOString()
  } else {
    const snoozeUntil = new Date(now)
    snoozeUntil.setDate(snoozeUntil.getDate() + SNOOZE_DAYS)
    update.checkin_snoozed_until = snoozeUntil.toISOString()
  }

  const { data, error } = await supabase
    .from('applications')
    .update(update)
    .eq('id', id)
    .eq('profile_id', user.id)
    .select('id, status, checkin_prompted_at, checkin_snoozed_until')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ application: data })
}
