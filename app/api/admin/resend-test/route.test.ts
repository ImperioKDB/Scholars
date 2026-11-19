import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { POST } from './route'
import { EmailProviderError } from '@/lib/email/providers/types'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertAdmin: vi.fn(),
  checkRateLimit: vi.fn(),
  sendWithResend: vi.fn(),
  sendEmail: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/admin/guard', () => ({ assertAdmin: mocks.assertAdmin }))
vi.mock('@/lib/ratelimit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/lib/email/providers/resend', () => ({ sendWithResend: mocks.sendWithResend }))
vi.mock('@/lib/email/send', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@/lib/logging', () => ({ logError: mocks.logError }))

const ADMIN_ID = 'admin-user-01'
const ADMIN_EMAIL = 'admin@scholars.example'
const client = { auth: { getUser: vi.fn() } }

function request(body?: unknown) {
  return new Request('https://scholars.example/api/admin/resend-test', {
    method: 'POST',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('RESEND_API_KEY', 'test-resend-secret')
  vi.stubEnv('RESEND_FROM_EMAIL', 'verified@scholars.example')
  mocks.checkRateLimit.mockResolvedValue(null)
  mocks.createClient.mockResolvedValue(client)
  mocks.assertAdmin.mockResolvedValue({ ok: true, userId: ADMIN_ID })
  client.auth.getUser.mockResolvedValue({ data: { user: { id: ADMIN_ID, email: ADMIN_EMAIL } }, error: null })
  mocks.sendWithResend.mockResolvedValue({ provider: 'resend', messageId: 're_test_123' })
})

afterEach(() => vi.unstubAllEnvs())

describe('POST /api/admin/resend-test', () => {
  it('rejects unauthenticated requests', async () => {
    mocks.assertAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) })
    const response = await POST(request())
    expect(response.status).toBe(401)
    expect(mocks.sendWithResend).not.toHaveBeenCalled()
    expect(client.auth.getUser).not.toHaveBeenCalled()
  })

  it('rejects non-admin requests', async () => {
    mocks.assertAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) })
    const response = await POST(request())
    expect(response.status).toBe(403)
    expect(mocks.sendWithResend).not.toHaveBeenCalled()
  })

  it('enforces three requests per minute through the shared rate limiter', async () => {
    mocks.checkRateLimit.mockResolvedValue(NextResponse.json({ error: 'Too many requests' }, { status: 429 }))
    const response = await POST(request())
    expect(response.status).toBe(429)
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(expect.any(Request), { route: 'admin-resend-test', limit: 3 })
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.sendWithResend).not.toHaveBeenCalled()
  })

  it.each(['RESEND_API_KEY', 'RESEND_FROM_EMAIL'])('rejects configuration missing %s', async (variable) => {
    vi.stubEnv(variable, '')
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect((await json(response)).error).toContain('RESEND_API_KEY and RESEND_FROM_EMAIL')
    expect(mocks.sendWithResend).not.toHaveBeenCalled()
  })

  it('rejects an authenticated admin without an email address', async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: { id: ADMIN_ID, email: null } }, error: null })
    const response = await POST(request())
    expect(response.status).toBe(400)
    expect(mocks.sendWithResend).not.toHaveBeenCalled()
  })

  it('sends exactly once directly through Resend and returns acceptance metadata', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await json(response)).toMatchObject({
      success: true, provider: 'resend', recipient: ADMIN_EMAIL, messageId: 're_test_123', accepted: true,
    })
    expect(mocks.sendWithResend).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.sendWithResend.mock.calls[0][0]).toMatchObject({
      to: ADMIN_EMAIL,
      subject: 'Scholars — Resend Integration Test',
      text: expect.stringContaining('sent directly through Resend'),
      idempotencyKey: expect.stringMatching(/^resend-test\//),
    })
    expect(mocks.sendWithResend.mock.calls[0][0].text).toContain('Test timestamp:')
    expect(mocks.sendWithResend.mock.calls[0][0].html).toContain('Resend dashboard')
  })

  it('ignores arbitrary recipient and content supplied in the request, including repeated attempts', async () => {
    await POST(request({ to: 'victim@example.test', from: 'attacker@example.test', subject: 'Injected', html: '<b>bad</b>' }))
    await POST(request({ to: 'another@example.test' }))
    expect(mocks.sendWithResend).toHaveBeenCalledTimes(2)
    for (const [input] of mocks.sendWithResend.mock.calls) {
      expect(input.to).toBe(ADMIN_EMAIL)
      expect(input.subject).toBe('Scholars — Resend Integration Test')
      expect(input.html).not.toContain('bad')
    }
    const firstKey = mocks.sendWithResend.mock.calls[0][0].idempotencyKey
    const secondKey = mocks.sendWithResend.mock.calls[1][0].idempotencyKey
    expect(firstKey).not.toBe(secondKey)
  })

  it('returns safe diagnostics when Resend rejects without leaking provider body or credentials', async () => {
    mocks.sendWithResend.mockRejectedValue(new EmailProviderError({
      provider: 'resend', status: 401, code: 'invalid_api_key', classification: 'definitive_rejection',
    }))
    const response = await POST(request())
    const body = await response.text()
    expect(response.status).toBe(502)
    expect(body).toContain('invalid_api_key')
    expect(body).not.toContain('test-resend-secret')
    expect(body).not.toContain(ADMIN_EMAIL)
    expect(mocks.logError).toHaveBeenCalledWith('admin/resend-test', 'resend_test_send_failed', {
      provider: 'resend', classification: 'definitive_rejection', status: 401, code: 'invalid_api_key',
    })
  })
})
