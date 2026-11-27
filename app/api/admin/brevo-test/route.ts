import { NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/admin/guard'
import { checkRateLimit } from '@/lib/ratelimit'
import { createClient } from '@/lib/supabase/server'
import { sendWithBrevo } from '@/lib/email/providers/brevo'
import { safeEmailErrorDiagnostic } from '@/lib/email/providers/types'
import { logError } from '@/lib/logging'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SUBJECT = 'Scholars — Brevo Integration Test'

function testEmailContent(timestamp: string) {
  return {
    html: `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172b4d"><main style="max-width:600px;margin:32px auto;padding:32px;background:#fff;border:1px solid #dce4ee;border-radius:16px"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#147d64">Scholars</div><h1 style="margin:20px 0 12px;font-size:24px;color:#172b4d">Brevo integration test</h1><p style="font-size:15px;line-height:1.6">This is a test message from Scholars, sent directly through Brevo to verify the Brevo API integration.</p><p style="font-size:15px;line-height:1.6">Check the Brevo dashboard for the corresponding delivery event. This response confirms API acceptance only; it does not confirm inbox delivery.</p><p style="margin-top:24px;font-size:13px;color:#607087">Test timestamp: <strong>${timestamp}</strong></p></main></body></html>`,
    text: [
      'Scholars — Brevo Integration Test',
      '',
      'This is a test message from Scholars, sent directly through Brevo to verify the Brevo API integration.',
      'Check the Brevo dashboard for the corresponding delivery event.',
      'API acceptance does not confirm inbox delivery.',
      `Test timestamp: ${timestamp}`,
    ].join('\n'),
  }
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-brevo-test', limit: 3 })
  if (limited) return limited

  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user || user.id !== guard.userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (!user.email) {
    return NextResponse.json({ error: 'Your authenticated account does not have an email address.' }, { status: 400 })
  }

  if (!process.env.BREVO_API_KEY || !process.env.REMINDER_FROM_EMAIL) {
    return NextResponse.json({ error: 'Brevo test is unavailable: configure BREVO_API_KEY and REMINDER_FROM_EMAIL.' }, { status: 503 })
  }

  const timestamp = new Date().toISOString()
  try {
    const result = await sendWithBrevo({
      to: user.email,
      subject: SUBJECT,
      ...testEmailContent(timestamp),
    })
    return NextResponse.json({
      success: true,
      provider: 'brevo',
      recipient: user.email,
      messageId: result.messageId,
      accepted: true,
    })
  } catch (error) {
    const diagnostic = safeEmailErrorDiagnostic(error)
    logError('admin/brevo-test', 'brevo_test_send_failed', diagnostic)
    const isUncertain = diagnostic.classification === 'uncertain_outcome'
    return NextResponse.json({
      success: false,
      error: isUncertain
        ? 'Brevo test outcome could not be determined.'
        : 'Brevo did not accept the test email.',
      diagnostic,
    }, { status: 502 })
  }
}
