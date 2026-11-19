import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendEmail, isEmailSendingConfigured, AutomaticEmailDisabledError } from './send'
import { EmailProviderError } from './providers/types'

const email = { to: 'student@example.test', subject: 'Test', html: '<p>Hi</p>', text: 'Hi', manual: true }
const response = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})

function configureBrevo() {
  vi.stubEnv('BREVO_API_KEY', 'brevo-super-secret')
  vi.stubEnv('REMINDER_FROM_EMAIL', 'brevo@scholars.example')
}
function configureResend() {
  vi.stubEnv('RESEND_API_KEY', 'resend-super-secret')
  vi.stubEnv('RESEND_FROM_EMAIL', 'verified@scholars.example')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('transactional email provider orchestration', () => {
  it('sends via Brevo first and does not call Resend on success', async () => {
    configureBrevo(); configureResend()
    const fetch = vi.fn().mockResolvedValue(response(201, { messageId: '<brevo-id>' }))
    vi.stubGlobal('fetch', fetch)
    const result = await sendEmail(email)
    expect(result).toMatchObject({ sent: 1, failed: 0, dry: false, provider: 'brevo', messageId: '<brevo-id>' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('falls back for Brevo insufficient credits and returns Resend message ID', async () => {
    configureBrevo(); configureResend()
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(402, { code: 'not_enough_credits', message: 'private response text' }))
      .mockResolvedValueOnce(response(200, { id: 're_123' }))
    vi.stubGlobal('fetch', fetch)
    const result = await sendEmail({ ...email, idempotencyKey: 'digest/delivery-uuid' })
    expect(result.provider).toBe('resend')
    expect(result.messageId).toBe('re_123')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][1].headers['Idempotency-Key']).toBe('digest/delivery-uuid')
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer resend-super-secret')
  })

  it('treats documented Brevo 429 rate-limit rejection as definitive and falls back', async () => {
    configureBrevo(); configureResend()
    const fetch = vi.fn().mockResolvedValueOnce(response(429, { code: 'rate_limit_exceeded' })).mockResolvedValueOnce(response(200, { id: 're_429' }))
    vi.stubGlobal('fetch', fetch)
    expect((await sendEmail(email)).provider).toBe('resend')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each([408, 409, 500, 503])('does not fail over for ambiguous Brevo HTTP %s', async (status) => {
    configureBrevo(); configureResend()
    const fetch = vi.fn().mockResolvedValue(response(status, { code: 'ambiguous', body: 'secret provider detail' }))
    vi.stubGlobal('fetch', fetch)
    await expect(sendEmail(email)).rejects.toMatchObject({ provider: 'brevo', status, classification: 'uncertain_outcome' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not fail over after a Brevo network failure', async () => {
    configureBrevo(); configureResend()
    const fetch = vi.fn().mockRejectedValue(new Error('socket reset with secret'))
    vi.stubGlobal('fetch', fetch)
    await expect(sendEmail(email)).rejects.toMatchObject({ code: 'network_error', classification: 'uncertain_outcome' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('supports a complete Resend-only configuration', async () => {
    configureResend()
    const fetch = vi.fn().mockResolvedValue(response(200, { id: 're_only' }))
    vi.stubGlobal('fetch', fetch)
    expect(isEmailSendingConfigured()).toBe(true)
    expect((await sendEmail(email)).provider).toBe('resend')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('disables Resend without its sender and preserves dry-run when neither provider is complete', async () => {
    vi.stubEnv('RESEND_API_KEY', 'resend-secret')
    expect(isEmailSendingConfigured()).toBe(false)
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await sendEmail(email)).toMatchObject({ sent: 0, failed: 0, dry: true })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps manual true mandatory', async () => {
    await expect(sendEmail({ ...email, manual: false })).rejects.toBeInstanceOf(AutomaticEmailDisabledError)
  })

  it('returns compatible SendResult fields', async () => {
    configureResend()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, { id: 're_compat' })))
    const result = await sendEmail(email)
    expect(result).toMatchObject({ sent: 1, failed: 0, dry: false })
  })

  it('never exposes keys or raw response bodies in provider errors', async () => {
    configureBrevo(); configureResend()
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const raw = 'raw body contains resend-super-secret and student@example.test'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(402, { code: 'not_enough_credits', message: raw })))
    // Fallback produces a safe typed Resend error.
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(response(402, { code: 'not_enough_credits', message: raw }))
      .mockResolvedValueOnce(response(500, { message: raw }))
    let thrown: unknown
    try { await sendEmail(email) } catch (error) { thrown = error }
    expect(thrown).toBeInstanceOf(EmailProviderError)
    expect(String(thrown)).not.toContain('resend-super-secret')
    expect(String(thrown)).not.toContain('raw body')
    expect(String(thrown)).not.toContain('student@example.test')
    expect(JSON.stringify(spy.mock.calls)).not.toContain(raw)
    expect(JSON.stringify(spy.mock.calls)).not.toContain('resend-super-secret')
  })
})
