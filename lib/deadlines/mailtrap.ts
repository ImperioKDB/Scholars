import { escapeHtml } from '@/lib/validate'
import { deadlineClosesAt, deadlineListingPath, deadlineMessage, type DeadlineListing } from './policy'

const mailtrapEndpoint = 'https://send.api.mailtrap.io/api/send'

type MailtrapConfig = { token: string; fromEmail: string; fromName: string; appOrigin: string }
type EmailOutcome =
  | { status: 'accepted'; messageId: string | null }
  | { status: 'retryable' | 'failed' | 'unknown'; code: string; retryAt?: string }

export function getDeadlineEmailConfig(): MailtrapConfig | null {
  const token = process.env.MAILTRAP_API_TOKEN?.trim()
  const fromEmail = process.env.DEADLINE_FROM_EMAIL?.trim()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!token || !fromEmail || !appUrl) return null
  try {
    const url = new URL(appUrl)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return {
      token,
      fromEmail,
      fromName: process.env.DEADLINE_FROM_NAME?.trim() || 'Scholars',
      appOrigin: url.origin,
    }
  } catch {
    return null
  }
}

function formatDeadline(date: string) {
  return `${new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric',
  })}, end of day (WAT)`
}

function remainingTime(date: string, now: number) {
  const hours = Math.ceil((deadlineClosesAt(date) - now) / 3_600_000)
  if (hours <= 0) return 'Deadline passed'
  if (hours <= 1) return 'Less than an hour left'
  if (hours < 48) return `About ${hours} hours left`
  return `About ${Math.floor(hours / 24)} days and ${hours % 24} hours left`
}

function oneLine(value: string, maxLength: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

export function renderDeadlineEmail(appOrigin: string, fullName: string | null, listings: DeadlineListing[]) {
  const name = oneLine(fullName ?? '', 120)
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const preferences = `${appOrigin}/settings#deadline-reminders`
  const first = listings[0]
  const passed = first.deadline_stage === 'passed'
  const subject = listings.length === 1
    ? `Scholars | ${passed ? 'Deadline passed' : 'Deadline reminder'} for ${oneLine(first.title, 100)}`
    : `Scholars | ${listings.length} ${passed ? 'deadlines have passed' : 'application deadlines to check'}`
  const now = Date.now()
  const content = listings.map((listing) => {
    const title = oneLine(listing.title, 180)
    return {
      title,
      message: deadlineMessage(listing.deadline_stage, title) ?? '',
      deadline: formatDeadline(listing.deadline_date),
      remaining: remainingTime(listing.deadline_date, now),
      status: listing.application_status === 'in_progress' ? 'Application in progress' : 'Saved to your list',
      url: `${appOrigin}${deadlineListingPath(listing)}`,
    }
  })

  const text = [
    'Scholars', greeting,
    ...content.map((item) => `${item.message}\nDeadline: ${item.deadline}\n${item.remaining}\nStatus: ${item.status}\n${item.url}`),
    `Manage deadline reminders: ${preferences}`,
  ].join('\n\n')

  const html = `<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;color:#142640">
    <main style="max-width:600px;margin:auto;padding:24px">
      <h1 style="color:#086d59">Scholars</h1><p>${escapeHtml(greeting)}</p>
      ${content.map((item) => `<section style="padding:12px 0;border-bottom:1px solid #e0e6ed">
        <h2 style="font-size:18px"><a href="${escapeHtml(item.url)}" style="color:#086d59">${escapeHtml(item.title)}</a></h2>
        <p>${escapeHtml(item.message)}<br>Deadline: ${escapeHtml(item.deadline)}<br>${escapeHtml(item.remaining)}<br>Status: ${escapeHtml(item.status)}</p>
      </section>`).join('')}
      <p><a href="${escapeHtml(preferences)}" style="color:#086d59">Manage deadline reminders</a></p>
    </main></body></html>`

  return { subject, text, html }
}

export async function sendDeadlineEmail(
  config: MailtrapConfig,
  recipient: string,
  fullName: string | null,
  listings: DeadlineListing[],
): Promise<EmailOutcome> {
  const message = renderDeadlineEmail(config.appOrigin, fullName, listings)
  try {
    const response = await fetch(mailtrapEndpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { email: config.fromEmail, name: config.fromName },
        to: [{ email: recipient }],
        category: 'Scholarship deadlines',
        ...message,
      }),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    })
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      const delay = /^\d+$/.test(retryAfter ?? '') ? Date.now() + Number(retryAfter) * 1000 : Date.parse(retryAfter ?? '')
      const max = Date.now() + 31 * 86_400_000
      const retryAt = Number.isFinite(delay) ? new Date(Math.min(delay, max)).toISOString() : undefined
      return { status: 'retryable', code: 'mailtrap_rate_limited', retryAt }
    }
    if (response.status === 408 || response.status >= 500) {
      return { status: 'unknown', code: `mailtrap_http_${response.status}` }
    }
    if (!response.ok) return { status: 'failed', code: `mailtrap_http_${response.status}` }

    const payload = await response.json() as { success?: boolean; message_ids?: unknown[] }
    if (payload.success === false) return { status: 'failed', code: 'mailtrap_rejected' }
    if (payload.success !== true) return { status: 'unknown', code: 'mailtrap_unrecognized_response' }
    const messageId = payload.message_ids?.[0]
    return { status: 'accepted', messageId: typeof messageId === 'string' ? messageId.slice(0, 200) : null }
  } catch {
    // Without an idempotency key or a definitive rejection a retry can duplicate email.
    return { status: 'unknown', code: 'mailtrap_response_unknown' }
  }
}
