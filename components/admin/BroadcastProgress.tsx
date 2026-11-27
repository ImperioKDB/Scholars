import { broadcastStatusKeys, type BroadcastState, type BroadcastStatus } from '@/lib/broadcast/status'

const labels: Record<BroadcastState, string> = {
  queued: 'Queued',
  processing: 'Processing',
  accepted: 'Provider accepted',
  failed: 'Definitively rejected',
  uncertain: 'Uncertain',
  quota_deferred: 'Quota deferred',
  unattempted: 'Unattempted',
  bookkeeping_errors: 'Bookkeeping errors',
}

const holds: Record<string, string> = {
  allocation_unavailable: 'Waiting for a verified provider allocation',
  daily_quota: 'Daily quota reached',
  monthly_quota: 'Monthly quota reached',
  provider_cooldown: 'Provider cooldown',
  provider_rate_limit: 'Provider rate limit reached',
}

function nextRun(hold: string | null, nextAt: string | null) {
  if (!hold || !holds[hold]) return null
  return holds[hold] + (nextAt ? ' · Next check ' + new Date(nextAt).toLocaleString() : '')
}

export function BroadcastProgress({ campaign }: { campaign: BroadcastStatus }) {
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
          {broadcastStatusKeys.map((key) => (
            <tr key={key}>
              <th scope="row" className="py-1 pr-4 font-normal">{labels[key]}</th>
              <td className="px-2">{campaign.email[key]}</td>
              <td className="px-2">{campaign.push_profiles[key]}</td>
              <td className="px-2">{campaign.push_devices[key]}</td>
            </tr>
          ))}
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
