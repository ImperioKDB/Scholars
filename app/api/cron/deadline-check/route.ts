import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runDailyPushCampaign } from '@/lib/push/campaigns'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Flags expired opportunities and sends due, opted-in push alerts for new
 * scholarship matches and saved-scholarship deadlines. Email delivery stays
 * disabled; this cron never calls an email provider.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const service = createServiceClient()
    const { data, error } = await service.rpc('flag_expired_opportunities')
    if (error) {
      console.error('deadline_check_failed', { code: error.code, message: error.message })
      return NextResponse.json({ error: 'Deadline check failed' }, { status: 500 })
    }

    const result = Array.isArray(data) ? data[0] : data
    const pushCampaign = await runDailyPushCampaign(service)
    return NextResponse.json({
      deadline_flags: Number(result?.flagged_count ?? 0),
      admin_notifications: Number(result?.notification_count ?? 0),
      push_campaign: pushCampaign,
      automatic_email_disabled: true,
      dry_run: false,
    })
  } catch (error) {
    console.error('deadline_check_failed', {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Deadline check failed' }, { status: 500 })
  }
}
