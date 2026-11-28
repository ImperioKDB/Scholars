import type { BroadcastStatus } from '@/lib/broadcast/status'

function holdLabel(hold: string | null) {
  switch (hold) {
    case 'allocation_unavailable': return 'Waiting for a verified provider allocation'
    case 'daily_quota': return 'Daily quota reached'
    case 'monthly_quota': return 'Monthly quota reached'
    case 'provider_cooldown': return 'Provider cooldown'
    case 'provider_rate_limit': return 'Provider rate limit reached'
    default: return null
  }
}

function nextRun(hold: string | null, nextAt: string | null) {
  const label = holdLabel(hold)
  if (!label) return null
  return label + (nextAt ? ' · Next check ' + new Date(nextAt).toLocaleString() : '')
}

function ProgressRow({ label, email, profiles, devices }: {
  label: string
  email: number
  profiles: number
  devices: number
}) {
  return (
    <tr>
      <th scope="row" className="py-1 pr-4 font-normal">{label}</th>
      <td className="px-2">{email}</td>
      <td className="px-2">{profiles}</td>
      <td className="px-2">{devices}</td>
    </tr>
  )
}

export function BroadcastProgress({ campaign }: { campaign: BroadcastStatus }) {
  const { email, push_profiles: profiles, push_devices: devices } = campaign
  const emailHold = nextRun(campaign.email_hold, campaign.email_next_at)
  const pushHold = nextRun(campaign.push_hold, campaign.push_next_at)
  return (
    <section className="overflow-x-auto">
      <h2 className="font-semibold text-navy">
        {campaign.batch ? `Batch ${campaign.batch}` : 'All recipients'} · {campaign.completed_at ? 'Processing complete' : 'In progress'}
      </h2>
      {emailHold && <p className="text-sm text-navy-light">Email · {emailHold}</p>}
      {pushHold && <p className="text-sm text-navy-light">Push · {pushHold}</p>}
      <table className="mt-3 w-full whitespace-nowrap text-left text-sm">
        <caption className="sr-only">Broadcast progress</caption>
        <thead className="border-b border-hairline text-navy">
          <tr>
            <th scope="col" className="py-2 pr-4">Status</th>
            <th scope="col" className="px-2">Email</th>
            <th scope="col" className="px-2">Push profiles</th>
            <th scope="col" className="px-2">Push devices</th>
          </tr>
        </thead>
        <tbody>
          <ProgressRow label="Queued" email={email.queued} profiles={profiles.queued} devices={devices.queued} />
          <ProgressRow label="Processing" email={email.processing} profiles={profiles.processing} devices={devices.processing} />
          <ProgressRow label="Provider accepted" email={email.accepted} profiles={profiles.accepted} devices={devices.accepted} />
          <ProgressRow label="Definitively rejected" email={email.failed} profiles={profiles.failed} devices={devices.failed} />
          <ProgressRow label="Uncertain" email={email.uncertain} profiles={profiles.uncertain} devices={devices.uncertain} />
          <ProgressRow label="Quota deferred" email={email.quota_deferred} profiles={profiles.quota_deferred} devices={devices.quota_deferred} />
          <ProgressRow label="Unattempted" email={email.unattempted} profiles={profiles.unattempted} devices={devices.unattempted} />
          <ProgressRow label="Bookkeeping errors" email={email.bookkeeping_errors} profiles={profiles.bookkeeping_errors} devices={devices.bookkeeping_errors} />
          <tr className="border-t border-hairline font-semibold">
            <th scope="row" className="py-2 pr-4">Recipients</th>
            <td className="px-2">{campaign.email.total}</td>
            <td className="px-2">{campaign.push_profiles.total}</td>
            <td className="px-2">{campaign.push_devices.total}</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}
