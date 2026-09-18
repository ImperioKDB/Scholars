import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const ALLOWED_RECIPIENT = 'talentedbeejay@gmail.com'

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.BREVO_API_KEY
  const from = process.env.REMINDER_FROM_EMAIL
  if (!apiKey || !from) {
    return NextResponse.json({ error: 'Email provider is not configured' }, { status: 500 })
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: from, name: 'Scholars' },
      to: [{ email: ALLOWED_RECIPIENT }],
      subject: '[Scholars] Manual delivery test',
      htmlContent: '<p>This is a manual end-to-end delivery test from Scholars.</p><p>If you received this message, Brevo delivery is working.</p>',
      textContent: 'This is a manual end-to-end delivery test from Scholars. If you received this message, Brevo delivery is working.',
    }),
  })
  const body = await response.text().catch(() => '')
  if (!response.ok) {
    return NextResponse.json({ error: `Brevo API error ${response.status}`, detail: body.slice(0, 300) }, { status: 502 })
  }

  let provider: unknown = null
  try {
    provider = JSON.parse(body)
  } catch {
    provider = { raw: body.slice(0, 300) }
  }
  return NextResponse.json({ sent: true, recipient: ALLOWED_RECIPIENT, provider })
}
