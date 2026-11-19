import type { ProviderSendInput, ProviderSendResult } from './types'
import { classifyBrevoStatus, EmailProviderError, readProviderErrorCode } from './types'

export const BREVO_EMAIL_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

export async function sendWithBrevo(input: ProviderSendInput): Promise<ProviderSendResult> {
  const apiKey = process.env.BREVO_API_KEY
  const from = process.env.REMINDER_FROM_EMAIL
  if (!apiKey || !from) throw new EmailProviderError({
    provider: 'brevo', status: null, code: 'provider_not_configured', classification: 'definitive_rejection',
  })

  let response: Response
  try {
    response = await fetch(BREVO_EMAIL_ENDPOINT, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: from, name: 'Scholars' },
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
      }),
    })
  } catch {
    throw new EmailProviderError({
      provider: 'brevo', status: null, code: 'network_error', classification: 'uncertain_outcome',
    })
  }

  if (!response.ok) {
    const code = await readProviderErrorCode(response)
    throw new EmailProviderError({
      provider: 'brevo', status: response.status, code, classification: classifyBrevoStatus(response.status),
    })
  }

  let messageId: string | null = null
  try {
    const payload: unknown = await response.clone().json()
    if (payload && typeof payload === 'object') {
      const id = (payload as Record<string, unknown>).messageId
      if (typeof id === 'string') messageId = id
    }
  } catch {
    // Brevo may return an empty success response; sending is still accepted.
  }
  return { provider: 'brevo', messageId }
}
