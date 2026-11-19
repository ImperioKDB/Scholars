'use client'

import { useRef, useState } from 'react'
import { StatusMessage } from '@/components/StatusMessage'

type ResendTestResponse = {
  success?: boolean
  recipient?: string
  messageId?: string | null
  error?: string
}

export function ResendTestButton() {
  const sendingRef = useRef(false)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function sendTest() {
    if (sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setSuccess(null)
    setError(null)
    try {
      const response = await fetch('/api/admin/resend-test', { method: 'POST' })
      const body = await response.json().catch(() => ({})) as ResendTestResponse
      if (!response.ok || !body.success || !body.recipient) {
        setError(body.error ?? 'Could not send the Resend test email.')
        return
      }
      setSuccess(`Resend accepted the test email for ${body.recipient}.${body.messageId ? ` Message ID: ${body.messageId}` : ''} Acceptance does not confirm inbox delivery.`)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-navy/10 bg-navy-50/50 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-navy">Resend Provider Test</h2>
          <p className="mt-1 max-w-2xl text-sm text-navy-light">
            Send one diagnostic email to the currently signed-in administrator to check the Resend API and sender configuration.
            This test sends directly through Resend. It does not use Brevo and does not contact students.
          </p>
        </div>
        <button
          type="button"
          onClick={sendTest}
          disabled={sending}
          className="shrink-0 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? 'Sending test email…' : 'Send Test Email via Resend'}
        </button>
      </div>
      <StatusMessage tone="success" className="mt-4">{success}</StatusMessage>
      <StatusMessage tone="error" className="mt-4">{error}</StatusMessage>
    </section>
  )
}
