'use client'

import { useRef, useState } from 'react'
import { StatusMessage } from '@/components/StatusMessage'

type BrevoTestResponse = {
  success?: boolean
  recipient?: string
  messageId?: string | null
  error?: string
  diagnostic?: {
    provider?: string | null
    classification?: string | null
    status?: number | null
    code?: string | null
    networkErrorName?: string | null
    networkErrorCode?: string | null
  }
}

export function BrevoTestButton() {
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
      const response = await fetch('/api/admin/brevo-test', { method: 'POST' })
      const body = await response.json().catch(() => ({})) as BrevoTestResponse
      if (!response.ok || !body.success || !body.recipient) {
        let msg = body.error ?? 'Could not send the Brevo test email.'
        const diag = body.diagnostic
        if (diag) {
          const parts: string[] = []
          if (diag.classification) parts.push(`outcome: ${diag.classification}`)
          if (diag.status !== null && diag.status !== undefined) parts.push(`status: ${diag.status}`)
          if (diag.code) parts.push(`code: ${diag.code}`)
          if (parts.length > 0) msg += ` · ${parts.join(' · ')}`
        }
        if (diag?.classification === 'uncertain_outcome') {
          msg += ' · Check Brevo logs before retrying.'
        }
        setError(msg)
        return
      }
      setSuccess(`Brevo accepted the test email for ${body.recipient}.${body.messageId ? ` Message ID: ${body.messageId}` : ''} Acceptance does not confirm inbox delivery.`)
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
          <h2 className="font-display text-lg font-semibold text-navy">Brevo Provider Test</h2>
          <p className="mt-1 max-w-2xl text-sm text-navy-light">
            Send one diagnostic email to the currently signed-in administrator to check the Brevo API and sender configuration.
            This test sends directly through Brevo. It does not use Resend and does not contact students.
          </p>
        </div>
        <button
          type="button"
          onClick={sendTest}
          disabled={sending}
          className="shrink-0 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? 'Sending test email…' : 'Send Test Email via Brevo'}
        </button>
      </div>
      <StatusMessage tone="success" className="mt-4">{success}</StatusMessage>
      <StatusMessage tone="error" className="mt-4">{error}</StatusMessage>
    </section>
  )
}
