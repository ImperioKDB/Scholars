import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ResendTestButton } from './ResendTestButton'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ResendTestButton', () => {
  it('explains the provider scope and sends to the server-selected administrator only', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true, recipient: 'admin@scholars.example', messageId: 're_abc123', accepted: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    render(<ResendTestButton />)

    expect(screen.getByRole('heading', { name: 'Resend Provider Test' })).toBeTruthy()
    expect(screen.getByText(/This test sends directly through Resend\. It does not use Brevo and does not contact students\./)).toBeTruthy()
    expect(screen.queryByLabelText(/recipient|email/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Send Test Email via Resend' }))

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('admin@scholars.example'))
    expect(screen.getByRole('status').textContent).toContain('re_abc123')
    expect(screen.getByRole('status').textContent).toContain('does not confirm inbox delivery')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/admin/resend-test', { method: 'POST' })
  })

  it('disables the button while a request is pending to prevent duplicate clicks', async () => {
    let resolveFetch!: (response: Response) => void
    const fetch = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { resolveFetch = resolve }))
    vi.stubGlobal('fetch', fetch)
    render(<ResendTestButton />)
    const button = screen.getByRole('button', { name: 'Send Test Email via Resend' }) as HTMLButtonElement

    fireEvent.click(button)
    expect(button.disabled).toBe(true)
    expect(button.textContent).toContain('Sending')
    fireEvent.click(button)
    expect(fetch).toHaveBeenCalledTimes(1)

    resolveFetch(new Response(JSON.stringify({ success: true, recipient: 'admin@scholars.example', messageId: 're_once' }), { status: 200 }))
    await waitFor(() => expect(button.disabled).toBe(false))
  })

  it('shows a clear error from a rejected request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false, error: 'Resend test is unavailable: configure RESEND_API_KEY and RESEND_FROM_EMAIL.',
    }), { status: 503, headers: { 'Content-Type': 'application/json' } })))
    render(<ResendTestButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Send Test Email via Resend' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('configure RESEND_API_KEY'))
  })
})
