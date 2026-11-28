// @ts-expect-error OpenNext generates this JavaScript entry during the Cloudflare build.
import openNext from './.open-next/worker.js'
// @ts-expect-error Keep the adapter's generated binding exports available.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js'
import { consumeBroadcasts, scheduleBroadcasts, type BroadcastWorkerEnv } from './lib/broadcast/worker'

export default {
  fetch: openNext.fetch,
  async scheduled(_event: unknown, env: BroadcastWorkerEnv) {
    await scheduleBroadcasts(env)
  },
  queue(batch: Parameters<typeof consumeBroadcasts>[0], env: BroadcastWorkerEnv) {
    return consumeBroadcasts(batch, env)
  },
}
