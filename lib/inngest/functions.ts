import { createServiceClient } from '@/lib/supabase/service'
import { getAuthEmailsByUserId } from '@/lib/email/authRecipients'
import { renderProfileNudge } from '@/lib/email/template'
import { sendEmail } from '@/lib/email/send'
import { claimNotificationDeliveryById, markNotificationAccepted, markNotificationRetryable } from '@/lib/email/outbox'
import { PROFILE_NUDGE_EVENT, inngest } from './client'
import { missingProfileLabels } from '@/lib/email/profileNudges'

const PROFILE_COLUMNS = 'id,full_name,profile_completeness'

export const sendProfileNudge = inngest.createFunction(
  {
    id: 'scholars-send-profile-nudge',
    retries: 5,
    concurrency: { limit: 20 },
    idempotency: 'event.data.deliveryId',
    triggers: { event: PROFILE_NUDGE_EVENT },
  },
  async ({ event, step }) => {
    const claimed = await step.run('claim-delivery', async () => {
      const supabase = createServiceClient()
      const { data: delivery, error } = await supabase
        .from('notification_deliveries')
        .select('id,profile_id,dedupe_key,campaign_key')
        .eq('id', event.data.deliveryId)
        .eq('campaign_key', 'profile_nudge')
        .maybeSingle()
      if (error) throw error
      if (!delivery) return null
      const claim = await claimNotificationDeliveryById(supabase, delivery.id, delivery.dedupe_key)
      return claim ? { id: delivery.id, profileId: delivery.profile_id } : null
    })

    if (!claimed) return { skipped: true, deliveryId: event.data.deliveryId }

    try {
      const message = await step.run('render-message', async () => {
        const supabase = createServiceClient()
        const [{ data: profile, error: profileError }, emails] = await Promise.all([
          supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', claimed.profileId).maybeSingle(),
          getAuthEmailsByUserId(supabase, [claimed.profileId]),
        ])
        if (profileError) throw profileError
        if (!profile) throw new Error(`Profile not found: ${claimed.profileId}`)
        const email = emails.get(claimed.profileId)
        if (!email) throw new Error(`Auth email not found: ${claimed.profileId}`)
        return {
          to: email,
          subjectAndBody: renderProfileNudge({
            firstName: profile.full_name?.trim().split(/\s+/)[0] || 'there',
            completeness: profile.profile_completeness,
            missingLabels: missingProfileLabels(profile as Record<string, unknown>),
            baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://www.scholars.com.ng',
          }),
        }
      })

      const result = await step.run('send-email', () =>
        sendEmail({
          to: message.to,
          subject: message.subjectAndBody.subject,
          html: message.subjectAndBody.html,
          text: message.subjectAndBody.text,
        }),
      )

      await step.run('record-success', async () => {
        const supabase = createServiceClient()
        await markNotificationAccepted(supabase, claimed.id)
        const { error } = await supabase
          .from('profiles')
          .update({
            profile_reminder_last_sent_at: new Date().toISOString(),
            profile_reminder_count: (await getReminderCount(supabase, claimed.profileId)) + 1,
          })
          .eq('id', claimed.profileId)
        if (error) throw error
      })

      return { deliveryId: claimed.id, sent: result.sent, dryRun: result.dry }
    } catch (error) {
      await step.run('record-retryable', async () => {
        const supabase = createServiceClient()
        await markNotificationRetryable(supabase, claimed.id, error)
      })
      throw error
    }
  },
)

async function getReminderCount(supabase: ReturnType<typeof createServiceClient>, profileId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('profile_reminder_count')
    .eq('id', profileId)
    .maybeSingle()
  if (error) throw error
  return Number(data?.profile_reminder_count ?? 0)
}
