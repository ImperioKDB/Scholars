import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runDailyPushCampaign } from '@/lib/push/campaigns'
import { deliverDeadlineReminders, getDeadlineBacklog, prepareDeadlineReminders } from '@/lib/deadlines/engine'
import { reconcileDeadlineEmails } from '@/lib/deadlines/mailtrapReceipts'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  return run(request, true)
}

export async function POST(request: Request) {
  return run(request, false)
}

async function run(request: Request, legacy: boolean) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requested = new URL(request.url).searchParams.get('task')
  // Unqualified GET is the old scheduler contract. New workflow tasks use
  // POST so a previous Worker revision responds 405 without running its cron.
  const task = legacy && requested === null ? 'maintenance' : requested
  if (!task || (legacy && requested !== null)
    || !['prepare', 'push', 'email', 'receipts', 'backlog', 'maintenance'].includes(task)) {
    return NextResponse.json({ error: 'Unknown deadline task' }, { status: 400 })
  }

  try {
    const service = createServiceClient()
    if (task === 'prepare') return NextResponse.json(await prepareDeadlineReminders(service))
    if (task === 'backlog') return NextResponse.json(await getDeadlineBacklog(service))
    if (task === 'receipts') return NextResponse.json(await reconcileDeadlineEmails(service))
    if (task === 'push' || task === 'email') {
      return NextResponse.json(await deliverDeadlineReminders(service, task))
    }

    // Retain PR #47's daily admin flags and new-match pushes, independently
    // of the hourly deadline delivery batches.
    const [flags, matches] = await Promise.allSettled([
      service.rpc('flag_expired_opportunities'),
      runDailyPushCampaign(service),
    ])
    if (flags.status === 'rejected' || flags.value.error || matches.status === 'rejected') {
      throw new Error('Daily maintenance failed')
    }
    const result = Array.isArray(flags.value.data) ? flags.value.data[0] : flags.value.data
    return NextResponse.json({
      deadline_flags: Number(result?.flagged_count ?? 0),
      admin_notifications: Number(result?.notification_count ?? 0),
      push_campaign: matches.value,
    })
  } catch {
    console.error('deadline_check_failed', { task })
    return NextResponse.json({ error: 'Deadline check failed' }, { status: 500 })
  }
}
