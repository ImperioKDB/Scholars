// app/api/feedback/route.ts
// POST /api/feedback { category, message, contact_email? }
//
// In-app feedback intake (components/FeedbackWidget.tsx FeedbackModal,
// triggered from the Sidebar account block). Inserts a row into
// public.feedback (migration 0014). Feedback is stored for admin review and
// never sends email automatically; email delivery requires an explicit admin
// action.
//
// Rate limited 5/hour per user on top of the IP bucket -- feedback is a
// low-volume, high-intent action, so the cap is generous for humans and
// still a brake on scripts.
//
// The stored page_url is also truncated so an absurd header can't bloat
// the row.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { logError } from '@/lib/logging'

const ROUTE = '/api/feedback'
const PAGE_URL_MAX = 2000

const bodySchema = z.object({
  category: z.enum(['bug', 'feature', 'scholarship', 'other']),
  message: z.string().trim().min(10, 'Please write at least 10 characters.').max(2000),
  contact_email: z.string().email().nullish(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const limited = await checkRateLimit(request, {
    route: 'feedback',
    limit: 5,
    extraKeys: [`user:${user.id}`],
  })
  if (limited) return limited

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid feedback', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const pageUrl = request.headers.get('referer')

  const { error: insertError } = await supabase.from('feedback').insert({
    profile_id: user.id,
    category: parsed.data.category,
    message: parsed.data.message,
    contact_email: parsed.data.contact_email ?? null,
    page_url: pageUrl ? pageUrl.slice(0, PAGE_URL_MAX) : null,
  })

  if (insertError) {
    logError(ROUTE, 'insert_failed', undefined, insertError)
    // 42501 = RLS denied the insert. In practice this means the feedback
    // policies from migration 0014 are missing in this database (partial
    // run, or run against a different project). Show a plain sentence
    // instead of leaking raw Postgres text to a student.
    const friendly =
      insertError.code === '42501'
        ? "We couldn't save your feedback yet because our database permissions are still being set up. Please try again shortly, or email support.scholarsteam@gmail.com directly."
        : 'We could not save your feedback. Please try again shortly.'
    return NextResponse.json({ error: friendly }, { status: 500 })
  }

  // Client (FeedbackModal) only checks res.ok, never reads the body, so
  // we don't need to return the inserted row's id. Keeping the response
  // minimal also avoids the TS strict-null complaint on data?.id when
  // .insert() isn't chained with .select().
  return NextResponse.json({ ok: true }, { status: 201 })
}
