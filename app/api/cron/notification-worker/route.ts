import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Scheduled outbound email delivery is intentionally paused. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    automatic_email_disabled: true,
    claimed: 0,
    sent: 0,
    failed: 0,
    dead_lettered: 0,
    dry_run: false,
  })
}
