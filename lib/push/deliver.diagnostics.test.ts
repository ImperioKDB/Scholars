import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendExpoPushMessages } from './send'
import webpush from 'web-push'
import { sendPushForProfile } from './deliver'

vi.mock('./send', () => ({
  sendExpoPushMessages: vi.fn(),
}))

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}))

const mockedExpoSend = vi.mocked(sendExpoPushMessages)
const mockedWebPush = vi.mocked(webpush)

function makeSupabase(options?: {
  expoError?: unknown
  expoTokens?: { id: string; expo_push_token: string }[]
  cleanupError?: Error
  webSubscriptions?: Array<{
    id: string
    endpoint: string
    p256dh: string
    auth: string
  }>
}) {
  return {
    from(table: string) {
      let limit = 100
      let cleanup = false
      return {
        select() { return this },
        eq() { return this },
        order() { return this },
        limit(value: number) { limit = value; return this },
        update() { cleanup = true; return this },
        delete() { cleanup = true; return this },
        in() { return this },
        retry(enabled: boolean) {
          expect(enabled).toBe(false)
          if (cleanup) return Promise.resolve({ error: options?.cleanupError })
          if (table === 'push_tokens') {
            return options?.expoError
              ? Promise.reject(options.expoError)
              : Promise.resolve({ data: options?.expoTokens?.slice(0, limit) ?? [], error: null })
          }

          return Promise.resolve({
            data: options?.webSubscriptions?.slice(0, limit) ?? [],
            error: null,
          })
        },
      }
    },
  } as never
}

describe('push delivery diagnostics', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('does not log Web Push endpoints, keys, or raw provider errors', async () => {
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY = 'public-test-key'
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = 'private-test-key'

    const endpoint = 'https://push.example.test/private-endpoint?token=endpoint-secret'
    const p256dh = 'p256dh-private-value'
    const auth = 'auth-private-value'
    const secretMessage = 'provider failed with https://push.example.test/token=provider-secret'

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mockedExpoSend.mockResolvedValue({
      invalidTokens: [],
      tickets: [],
    } as never)

    mockedWebPush.sendNotification.mockRejectedValue(
      new Error(secretMessage),
    )

    const result = await sendPushForProfile(
      makeSupabase({
        webSubscriptions: [{
          id: 'subscription-1',
          endpoint,
          p256dh,
          auth,
        }],
      }),
      'profile-test',
      { title: 'Test', body: 'Test body' },
    )

    expect(result.failed).toBe(1)

    const logged = JSON.stringify(warn.mock.calls)

    for (const secret of [
      endpoint,
      p256dh,
      auth,
      secretMessage,
      'provider-secret',
    ]) {
      expect(logged).not.toContain(secret)
    }

    expect(logged).toContain('"errorName":"Error"')
  })

  it('caps both provider paths and preserves acceptance when expired-device cleanup fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY', 'public-test-key')
    vi.stubEnv('WEB_PUSH_VAPID_PRIVATE_KEY', 'private-test-key')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockedExpoSend.mockResolvedValue({
      invalidTokens: ['expo-0'],
      tickets: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }, ...Array(3).fill({ status: 'ok' })],
    })
    mockedWebPush.sendNotification.mockRejectedValue({ statusCode: 410 })

    const result = await sendPushForProfile(makeSupabase({
      expoTokens: Array.from({ length: 12 }, (_, index) => ({ id: String(index), expo_push_token: `expo-${index}` })),
      webSubscriptions: Array.from({ length: 12 }, (_, index) => ({
        id: String(index), endpoint: 'https://example.test/push', p256dh: 'test', auth: 'test',
      })),
      cleanupError: new Error('cleanup unavailable'),
    }), 'profile-test', { title: 'Test', body: 'Test body' }, { deviceLimit: 4 })

    expect(mockedExpoSend).toHaveBeenCalledOnce()
    expect(mockedExpoSend.mock.calls[0][0]).toHaveLength(4)
    expect(mockedWebPush.sendNotification).toHaveBeenCalledTimes(4)
    expect(result).toMatchObject({ targets: 8, accepted: 3, expired: 5 })
  })

  it('sanitizes Expo channel query failures', async () => {
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY = ''
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = ''

    const secretMessage =
      'database error https://db.example.test/?apikey=private-secret'

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mockedExpoSend.mockResolvedValue({
      invalidTokens: [],
      tickets: [],
    } as never)

    const result = await sendPushForProfile(
      makeSupabase({ expoError: new Error(secretMessage) }),
      'profile-test',
      { title: 'Test', body: 'Test body' },
    )

    expect(result.failed).toBe(1)

    const logged = JSON.stringify(warn.mock.calls)

    expect(logged).not.toContain(secretMessage)
    expect(logged).not.toContain('private-secret')
    expect(logged).toContain('"errorName":"Error"')
  })
})
