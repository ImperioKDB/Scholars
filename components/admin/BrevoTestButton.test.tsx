import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrevoTestButton } from './BrevoTestButton'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('BrevoTestButton', () => {
  it('explains the provider scope and sends to the server-selected administrator only', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true, recipient: 'admin@scholars.example', messageId: 'br_abc123', accepted: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    render(<BrevoTestButton />)

    expect(screen.getByRole('heading', { name: 'Brevo Provider Test' })).toBeTruthy()
    expect(screen.getByText(/This test sends directly through Brevo\. It does not use Resend and does not contact students\./)).toBeTruthy()
    expect(screen.queryByLabelText(/recipient|email/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Send Test Email via Brevo' }))

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('admin@scholars.example'))
    expect(screen.getByRole('status').textContent).toContain('br_abc123')
    expect(screen.getByRole('status').textContent).toContain('does not confirm inbox delivery')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/admin/brevo-test', { method: 'POST' })
  })

  it('disables the button while a request is pending to prevent duplicate clicks', async () => {
    let resolveFetch!: (response: Response) => void
    const fetch = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { resolveFetch = resolve }))
    vi.stubGlobal('fetch', fetch)
    render(<BrevoTestButton />)
    const button = screen.getByRole('button', { name: 'Send Test Email via Brevo' }) as HTMLButtonElement

    fireEvent.click(button)
    expect(button.disabled).toBe(true)
    expect(button.textContent).toContain('Sending')
    fireEvent.click(button)
    expect(fetch).toHaveBeenCalledTimes(1)

    resolveFetch(new Response(JSON.stringify({ success: true, recipient: 'admin@scholars.example', messageId: 'br_once' }), { status: 200 }))
    await waitFor(() => expect(button.disabled).toBe(false))
  })

  it('shows a clear error from a rejected request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false, error: 'Brevo test is unavailable: configure BREVO_API_KEY and REMINDER_FROM_EMAIL.',
    }), { status: 503, headers: { 'Content-Type': 'application/json' } })))
    render(<BrevoTestButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Send Test Email via Brevo' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('configure BREVO_API_KEY'))
  })
})
