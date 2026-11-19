// Application-side transactional mail only. Supabase Auth email delivery is a separate path.
import { logWarn } from '@/lib/logging'
import { sendWithBrevo } from '@/lib/email/providers/brevo'
import { sendWithResend } from '@/lib/email/providers/resend'
import { EmailProviderError, type EmailProvider, type ProviderSendResult } from '@/lib/email/providers/types'

export type SendResult = { sent: number; failed: number; dry: boolean; provider?: EmailProvider; messageId?: string | null }

export class AutomaticEmailDisabledError extends Error {
  constructor() {
    super('Automatic email sending is disabled. Send from an admin action instead.')
    this.name = 'AutomaticEmailDisabledError'
  }
}

export function isEmailSendingConfigured(): boolean {
  const brevo = Boolean(process.env.BREVO_API_KEY && process.env.REMINDER_FROM_EMAIL)
  const resend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)
  if (process.env.RESEND_API_KEY && !process.env.RESEND_FROM_EMAIL) {
    logWarn('email/send', 'resend_disabled_missing_sender', { provider: 'resend', code: 'missing_from_email' })
  }
  return brevo || resend
}

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text: string
  manual?: boolean
  idempotencyKey?: string
}): Promise<SendResult> {
  if (!params.manual) throw new AutomaticEmailDisabledError()
  const input = {
    to: params.to, subject: params.subject, html: params.html, text: params.text,
    idempotencyKey: params.idempotencyKey,
  }
  const brevoConfigured = Boolean(process.env.BREVO_API_KEY && process.env.REMINDER_FROM_EMAIL)
  const resendConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)

  if (brevoConfigured) {
    try {
      const result = await sendWithBrevo(input)
      return successfulResult(result)
    } catch (error) {
      if (!(error instanceof EmailProviderError) || error.classification !== 'definitive_rejection') throw error
      if (!resendConfigured) throw error
      logWarn('email/send', 'brevo_definitive_rejection_falling_back', {
        provider: error.provider, status: error.status, code: error.code, classification: error.classification,
      })
    }
  }

  if (resendConfigured) return successfulResult(await sendWithResend(input))

  if (process.env.RESEND_API_KEY && !process.env.RESEND_FROM_EMAIL) {
    logWarn('email/send', 'resend_disabled_missing_sender', { provider: 'resend', code: 'missing_from_email' })
  }
  if (!brevoConfigured) {
    logWarn('email/send', 'email_skipped_dry_run', { subject: params.subject })
    return { sent: 0, failed: 0, dry: true }
  }
  // Reachable when Brevo definitively rejected and no usable fallback exists.
  throw new EmailProviderError({
    provider: 'brevo', status: null, code: 'fallback_unavailable', classification: 'definitive_rejection',
  })
}

function successfulResult(result: ProviderSendResult): SendResult {
  return { sent: 1, failed: 0, dry: false, provider: result.provider, messageId: result.messageId }
}
