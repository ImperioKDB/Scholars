import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Scheduled email delivery is intentionally paused. Keep this endpoint in
 * place because Vercel Cron may still call it, but never enqueue or send mail.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    automatic_email_disabled: true,
    deadline_reminders: 0,
    profile_nudges: 0,
    new_listing_digests: 0,
    emails_sent: 0,
    failed: 0,
    dry_run: false,
  })
}
