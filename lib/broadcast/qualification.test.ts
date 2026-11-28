import { afterEach, expect, it, vi } from 'vitest'
import {
  BROADCAST_STAGING_DATABASE,
  BROADCAST_STAGING_PROJECT,
  isBroadcastStagingAppRequest,
  isBroadcastStagingDatabase,
  stagingBroadcastExecution,
  stubBroadcastProvider,
} from './qualification'
import { productionBroadcastQueues, stagingBroadcastQueues } from './queueNames'
import { consumeBroadcasts, scheduleBroadcasts } from './worker'

function stageKey(role: string, ref = BROADCAST_STAGING_PROJECT) {
  return 'test.' + btoa(JSON.stringify({ ref, role })) + '.test'
}

const job = { id: '00000000-0000-4000-8000-000000000001' }
const batch = (queue: string) => ({ queue, messages: [{ body: job, ack: vi.fn() }] })
function env(enabled = 'true') {
  return {
    NEXT_PUBLIC_SUPABASE_URL: BROADCAST_STAGING_DATABASE,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: stageKey('anon'),
    SUPABASE_SERVICE_ROLE_KEY: stageKey('service_role'),
    BROADCAST_CONSUMERS_ENABLED: enabled,
    BROADCAST_EMAIL_QUEUE: { send: vi.fn() },
    BROADCAST_PUSH_QUEUE: { send: vi.fn() },
  }
}

afterEach(() => vi.unstubAllGlobals())

it('accepts only the pinned staging host and role-specific keys from that project', () => {
  expect(isBroadcastStagingDatabase(env())).toBe(true)
  expect(isBroadcastStagingDatabase({ ...env(), NEXT_PUBLIC_SUPABASE_URL: 'https://production.example.invalid' })).toBe(false)
  expect(isBroadcastStagingDatabase({ ...env(), SUPABASE_SERVICE_ROLE_KEY: stageKey('service_role', 'another-project') })).toBe(false)
  expect(isBroadcastStagingDatabase({ ...env(), NEXT_PUBLIC_SUPABASE_ANON_KEY: stageKey('service_role') })).toBe(false)
})

it('permits the admin workflow while excluding real provider test and cron routes', () => {
  const request = (path: string, method = 'GET') => new Request('https://stage.example.invalid' + path, { method })
  expect(isBroadcastStagingAppRequest(request('/admin/broadcast'))).toBe(true)
  expect(isBroadcastStagingAppRequest(request('/api/admin/broadcast?id=' + job.id))).toBe(true)
  expect(isBroadcastStagingAppRequest(request('/api/admin/broadcast', 'POST'))).toBe(true)
  for (const path of ['/api/admin/brevo-test', '/api/admin/resend-test', '/api/admin/independence-day', '/api/cron/deadline-check']) {
    expect(isBroadcastStagingAppRequest(request(path, 'POST'))).toBe(false)
  }
})

it('cannot send or touch the database with consumers disabled in either mode', async () => {
  const network = vi.fn()
  vi.stubGlobal('fetch', network)
  const bindings = env('false')
  const staging = stagingBroadcastExecution(bindings)
  await scheduleBroadcasts(bindings)
  await scheduleBroadcasts(staging.bindings, undefined, true)
  for (const lane of ['email', 'push'] as const) {
    const production = batch(productionBroadcastQueues[lane])
    const isolated = batch(stagingBroadcastQueues[lane])
    await consumeBroadcasts(production, bindings)
    await consumeBroadcasts(isolated, staging.bindings, staging.qualification)
    expect(production.messages[0].ack).toHaveBeenCalledOnce()
    expect(isolated.messages[0].ack).toHaveBeenCalledOnce()
  }
  expect(network).not.toHaveBeenCalled()
  expect(bindings.BROADCAST_EMAIL_QUEUE.send).not.toHaveBeenCalled()
  expect(bindings.BROADCAST_PUSH_QUEUE.send).not.toHaveBeenCalled()
})

it('routes only the exact queue names for each runtime', async () => {
  const network = vi.fn(async () => Response.json(null))
  vi.stubGlobal('fetch', network)
  const production = env()
  const staging = stagingBroadcastExecution(env())
  for (const lane of ['email', 'push'] as const) {
    await consumeBroadcasts(batch(stagingBroadcastQueues[lane]), production)
    await consumeBroadcasts(batch(productionBroadcastQueues[lane]), staging.bindings, staging.qualification)
  }
  expect(network).not.toHaveBeenCalled()
  for (const lane of ['email', 'push'] as const) {
    await consumeBroadcasts(batch(productionBroadcastQueues[lane]), production)
    await consumeBroadcasts(batch(stagingBroadcastQueues[lane]), staging.bindings, staging.qualification)
  }
  expect(network).toHaveBeenCalledTimes(4)
})

it('mocks provider responses locally and refuses non-synthetic recipients', async () => {
  const network = vi.fn()
  vi.stubGlobal('fetch', network)
  const mail = (email: string) => ({ body: JSON.stringify({ to: [{ email }] }) })
  expect((await stubBroadcastProvider('https://api.brevo.com/v3/smtp/email',
    mail('broadcast-qualification-001@broadcast.example.invalid'))).status).toBe(201)
  expect((await stubBroadcastProvider('https://exp.host/--/api/v2/push/send',
    { body: JSON.stringify([{ to: 'ExpoPushToken[BroadcastQualification039]' }]) })).status).toBe(200)
  expect((await stubBroadcastProvider('https://fcm.googleapis.com/send/broadcast-qualification-078',
    { headers: { 'content-encoding': 'aes128gcm' } })).status).toBe(201)
  await expect(stubBroadcastProvider('https://api.brevo.com/v3/smtp/email', mail('regular@example.invalid'))).rejects.toThrow()
  await expect(stubBroadcastProvider('https://fcm.googleapis.com/send/real-device')).rejects.toThrow()
  expect(network).not.toHaveBeenCalled()
})
