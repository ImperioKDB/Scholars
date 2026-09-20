import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { sendDeadlineReminder, sendProfileNudge } from '@/lib/inngest/functions'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendProfileNudge, sendDeadlineReminder],
})
