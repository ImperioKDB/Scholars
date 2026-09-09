// lib/email/send.ts
// Shared Brevo transactional send wrapper so the cron and the admin
// manual trigger use one implementation.
//
// Dry-run safe: missing BREVO_API_KEY or REMINDER_FROM_EMAIL logs and
// returns dry:true instead of throwing, so a misconfigured environment
// never breaks the caller. The digest summary surfaces dry_run so the
// admin UI can say honestly that nothing was sent.
import { logWarn } from '@/lib/logging'

export type SendResult = { sent: number; failed: number; dry: boolean }

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY
  const from = process.env.REMINDER_FROM_EMAIL
  if (!apiKey || !from) {
    logWarn('email/send', 'email_skipped_dry_run', { to: params.to, subject: params.subject })
    return { sent: 0, failed: 0, dry: true }
  }
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: from, name: 'Scholars' },
      to: [{ email: params.to }],
      subject: params.subject,
      htmlContent: params.html,
      textContent: params.text,
    }),
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`Brevo API error ${resp.status}: ${body.slice(0, 300)}`)
  }
  return { sent: 1, failed: 0, dry: false }
}
