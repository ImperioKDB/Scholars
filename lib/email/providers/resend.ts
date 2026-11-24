import type { ProviderSendInput, ProviderSendResult } from './types'
import { classifyResendStatus, EmailProviderError, readProviderErrorCode } from './types'

export const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails'

export async function sendWithResend(input: ProviderSendInput): Promise<ProviderSendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) throw new EmailProviderError({
    provider: 'resend', status: null, code: 'provider_not_configured', classification: 'definitive_rejection',
  })

  let response: Response
  try {
    response = await fetch(RESEND_EMAIL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
    })
  } catch (error) {
    throw new EmailProviderError({
      provider: 'resend',
      status: null,
      code: 'network_error',
      classification: 'uncertain_outcome',
      networkError: error,
    })
  }

  if (!response.ok) {
    const code = await readProviderErrorCode(response)
    throw new EmailProviderError({
      provider: 'resend', status: response.status, code, classification: classifyResendStatus(response.status),
    })
  }

  let messageId: string | null = null
  try {
    const payload: unknown = await response.clone().json()
    if (payload && typeof payload === 'object') {
      const id = (payload as Record<string, unknown>).id
      if (typeof id === 'string') messageId = id
    }
  } catch {
    // Keep successful acceptance even if the response contains no parseable ID.
  }
  return { provider: 'resend', messageId }
}
