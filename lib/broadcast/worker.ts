import { dispatchBroadcast, prepareBroadcast, type BroadcastProviderEnv, type CampaignContent, type ClaimTarget } from './providers'
import { BroadcastBudget, broadcastDatabase, type BroadcastDatabaseEnv } from './transport'

type Channel = 'email' | 'push'
type Wake = { id: string }
type Queue = { send(body: Wake, options?: { delaySeconds?: number }): Promise<void> }
type Claim = { token: string; target: null } | {
  token: string; campaign: string; target: ClaimTarget; content: CampaignContent
}
type Intent = { attempt: string; lease_until: string }
export type BroadcastWorkerEnv = BroadcastDatabaseEnv & BroadcastProviderEnv & {
  BROADCAST_CONSUMERS_ENABLED?: string
  BROADCAST_EMAIL_QUEUE: Queue
  BROADCAST_PUSH_QUEUE: Queue
}
type Message = { body: unknown; ack(): void }
type Batch = { queue: string; messages: readonly Message[] }

const queueNames = { email: 'scholars-broadcast-email', push: 'scholars-broadcast-push' } as const
const jobIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function queueFor(env: BroadcastWorkerEnv, channel: Channel) {
  return channel === 'email' ? env.BROADCAST_EMAIL_QUEUE : env.BROADCAST_PUSH_QUEUE
}

async function wake(env: BroadcastWorkerEnv, budget: BroadcastBudget, channel: Channel, id: string, delaySeconds = 0) {
  try {
    await budget.operation(() => queueFor(env, channel).send({ id }, { delaySeconds }))
  } catch {
    // The scheduled check will recover work if publishing failed.
    console.error(JSON.stringify({ event: 'broadcast_wakeup_failed', channel, job: id, operations: budget.used }))
  }
}

export async function scheduleBroadcasts(env: BroadcastWorkerEnv, budget = new BroadcastBudget()) {
  if (env.BROADCAST_CONSUMERS_ENABLED !== 'true') return
  try {
    const rpc = broadcastDatabase(env, budget)
    const jobs = await rpc<{ id: string; channel: Channel }[]>('broadcast_due_jobs')
    await Promise.all(jobs.slice(0, 2).map(async (job) => {
      if (job.channel === 'email' || job.channel === 'push') await wake(env, budget, job.channel, job.id)
    }))
  } catch {
    console.error(JSON.stringify({ event: 'broadcast_schedule_failed', operations: budget.used }))
  }
}

export async function processBroadcast(env: BroadcastWorkerEnv, channel: Channel, id: string, budget = new BroadcastBudget()) {
  if (env.BROADCAST_CONSUMERS_ENABLED !== 'true') return
  const rpc = broadcastDatabase(env, budget)
  const claim = await rpc<Claim | null>('broadcast_claim', { p_job: id, p_channel: channel })
  if (!claim) return

  const lease = { p_job: id, p_token: claim.token }
  if (claim.target) {
    const target = claim.target
    const dispatch = prepareBroadcast(env, claim.campaign, claim.content, target)
    // One begin, one provider call, two attempts to save the same outcome,
    // one release and one wakeup. Never dispatch without finalization capacity.
    budget.require(6)
    const intent = await rpc<Intent | null>('broadcast_begin', {
      ...lease, p_target: target.id,
      p_provider: typeof dispatch === 'string' ? null : dispatch.key,
      p_skip_reason: typeof dispatch === 'string' ? dispatch : null,
    })
    if (intent && typeof dispatch !== 'string') {
      const outcome = Date.parse(intent.lease_until) - Date.now() < 5_000
        ? { state: 'uncertain' as const, reason: 'dispatch_authority_expiring' }
        : await dispatchBroadcast(dispatch, budget.fetch)
      if (outcome.state === 'accepted') {
        console.info(JSON.stringify({
          event: 'broadcast_provider_accepted', channel, campaign: claim.campaign,
          target: target.id, attempt: intent.attempt, provider: dispatch.provider, messageId: outcome.messageId ?? null,
        }))
      }
      const record = {
        p_target: target.id, p_attempt: intent.attempt, p_outcome: outcome.state,
        p_provider_id: outcome.messageId ?? null, p_reason: outcome.reason ?? null,
        p_retry_seconds: outcome.retrySeconds ?? null,
      }
      const finalize = async () => {
        if (!(await rpc<boolean>('broadcast_finalize', record))) throw new Error('broadcast_finalization_fence')
      }
      try {
        await finalize()
      } catch {
        // Retry only the database acknowledgement for this exact attempt.
        await finalize()
      }
    }
  }
  const released = await rpc<{ next_at: string | null } | null>('broadcast_release', lease)
  if (released?.next_at) {
    const delay = Math.max(1, Math.ceil((Date.parse(released.next_at) - Date.now()) / 1000))
    if (delay <= 60) await wake(env, budget, channel, id, delay)
  }
}

export async function consumeBroadcasts(batch: Batch, env: BroadcastWorkerEnv) {
  // Wrangler delivers one wake per invocation. Discard unexpected events and
  // let Cron recover the durable database jobs.
  const channel = batch.queue === queueNames.email ? 'email' : batch.queue === queueNames.push ? 'push' : null
  const message = batch.messages[0]
  if (channel && message && typeof message.body === 'object' && message.body !== null
    && 'id' in message.body && typeof message.body.id === 'string' && jobIdPattern.test(message.body.id)) {
    const budget = new BroadcastBudget()
    try {
      await processBroadcast(env, channel, message.body.id, budget)
    } catch {
      // A database or runtime error must leave the lease and attempt intact.
      // Cron will recover it even if this message is lost.
      console.error(JSON.stringify({
        event: 'broadcast_slice_failed', channel, job: message.body.id, operations: budget.used,
      }))
    }
  }
  for (const item of batch.messages) item.ack()
}
