import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertAdmin } from '@/lib/admin/guard'
import { checkRateLimit } from '@/lib/ratelimit'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ensureNotificationDelivery } from '@/lib/email/outbox'
import { inngest, PROFILE_NUDGE_EVENT } from '@/lib/inngest/client'

const TEST_EMAIL = 'talentedbeejay@gmail.com'
const bodySchema = z.object({ confirm: z.literal('SEND_PROFILE_NUDGE_TEST') })

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-test-profile-nudge', limit: 2 })
  if (limited) return limited

  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
  }

  const service = createServiceClient()
  let profileId: string | null = null
  for (let page = 1; page <= 100 && !profileId; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    const match = data.users.find((user) => user.email?.toLowerCase() === TEST_EMAIL)
    if (match) profileId = match.id
    if (data.users.length < 100) break
  }
  if (!profileId) return NextResponse.json({ error: 'Approved test email is not a Scholars account' }, { status: 404 })

  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '')
  const dedupeKey = `profile_nudge_test:${profileId}:${timestamp}`
  const delivery = await ensureNotificationDelivery(service, {
    profileId,
    campaignKey: 'profile_nudge',
    scheduleBucket: 'manual-test',
    dedupeKey,
    templateVersion: 'profile-nudge-v1',
  })
  if (!delivery) return NextResponse.json({ error: 'Could not create test delivery' }, { status: 500 })

  const eventId = `manual-profile-nudge-test:${delivery.id}`
  await inngest.send({
    name: PROFILE_NUDGE_EVENT,
    id: eventId,
    data: { deliveryId: delivery.id, correlationId: eventId },
  })

  return NextResponse.json({
    ok: true,
    recipient: TEST_EMAIL,
    deliveryId: delivery.id,
    eventId,
    status: delivery.status,
  })
}
