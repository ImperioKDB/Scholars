// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderDeadlineEmail, sendDeadlineEmail } from './mailtrap'
import type { DeadlineListing } from './policy'

const config = {
  token: 'test-only',
  fromEmail: 'deadlines@example.test',
  fromName: 'Scholars',
  appOrigin: 'https://scholars.example.test',
}
const listing: DeadlineListing = {
  scholarship_id: 'scholarship-1',
  opportunity_id: null,
  title: 'STEM <Scholarship> & award',
  deadline_date: '2026-12-01',
  deadline_stage: 'last_24h',
  application_status: 'in_progress',
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('deadline email', () => {
  it('includes actual WAT deadline, remaining time, and safely combines listings', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-12-01T05:00:00Z'))
    const email = renderDeadlineEmail(config.appOrigin, '<Student>', [
      listing,
      { ...listing, scholarship_id: null, opportunity_id: 'opportunity-2', application_status: null },
    ])
    expect(email.subject).toContain('2 application deadlines')
    expect(email.html).toContain('&lt;Student&gt;')
    expect(email.html).toContain('STEM &lt;Scholarship&gt; &amp; award')
    expect(email.html).not.toContain('<Scholarship>')
    expect(email.text).toContain('1 December 2026, end of day (WAT)')
    expect(email.text).toContain('About 18 hours left')
    expect(email.text).toContain('Application in progress')
    expect(email.text).toContain('Saved to your list')
    expect(email.text).toContain('/opportunities/opportunity-2')
    expect(email.text).toContain('/settings#deadline-reminders')
  })

  it('records Mailtrap acceptance without claiming inbox delivery', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ success: true, message_ids: ['mailtrap-1'] }))
    vi.stubGlobal('fetch', fetch)
    await expect(sendDeadlineEmail(config, 'student@example.test', null, [listing]))
      .resolves.toEqual({ status: 'accepted', messageId: 'mailtrap-1' })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://send.api.mailtrap.io/api/send')
    expect(init.headers.Authorization).toBe('Bearer test-only')
    expect(JSON.parse(init.body)).toMatchObject({
      from: { email: config.fromEmail, name: config.fromName },
      to: [{ email: 'student@example.test' }],
    })
  })

  it.each([
    [429, 'retryable'],
    [400, 'failed'],
    [401, 'failed'],
    [408, 'unknown'],
    [503, 'unknown'],
  ])('classifies HTTP %i as %s with one request', async (code, status) => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: code }))
    vi.stubGlobal('fetch', fetch)
    await expect(sendDeadlineEmail(config, 'student@example.test', null, [listing]))
      .resolves.toMatchObject({ status })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('handles explicit rejection, malformed success and interrupted responses', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ success: false }))
      .mockResolvedValueOnce(new Response('invalid response'))
      .mockRejectedValueOnce(new Error('private error details'))
    vi.stubGlobal('fetch', fetch)
    const send = () => sendDeadlineEmail(config, 'student@example.test', null, [listing])
    expect((await send()).status).toBe('failed')
    expect((await send()).status).toBe('unknown')
    expect(await send()).toEqual({ status: 'unknown', code: 'mailtrap_response_unknown' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
