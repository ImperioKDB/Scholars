// @ts-expect-error OpenNext generates the entry during the Cloudflare build.
import openNext from './.open-next/worker.js'
import {
  isBroadcastStagingAppRequest,
  isBroadcastStagingDatabase,
  stagingBroadcastExecution,
  type BroadcastStagingEnv,
} from './lib/broadcast/qualification'
import { consumeBroadcasts, scheduleBroadcasts } from './lib/broadcast/worker'

export default {
  fetch(request: Request, env: BroadcastStagingEnv, context: unknown) {
    if (!isBroadcastStagingDatabase(env)) return new Response('Staging database binding required', { status: 503 })
    if (!isBroadcastStagingAppRequest(request)) return new Response(null, { status: 404 })
    return openNext.fetch(request, env, context)
  },
  async scheduled(_event: unknown, env: BroadcastStagingEnv) {
    if (isBroadcastStagingDatabase(env)) {
      await scheduleBroadcasts(stagingBroadcastExecution(env).bindings, undefined, true)
    }
  },
  queue(batch: Parameters<typeof consumeBroadcasts>[0], env: BroadcastStagingEnv) {
    if (!isBroadcastStagingDatabase(env)) {
      for (const message of batch.messages) message.ack()
      return
    }
    const { bindings, qualification } = stagingBroadcastExecution(env)
    return consumeBroadcasts(batch, bindings, qualification)
  },
}
