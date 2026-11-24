import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ensureNotificationDelivery,
  claimNotificationDeliveryById,
} from '@/lib/email/outbox'
import { sendPushForProfile } from './deliver'
import { sendAdminBroadcastPush } from './adminBroadcast'

vi.mock('@/lib/email/outbox', () => ({
  ensureNotificationDelivery: vi.fn(),
  claimNotificationDeliveryById: vi.fn(),
  markNotificationAccepted: vi.fn(),
}))

vi.mock('./deliver', () => ({
  sendPushForProfile: vi.fn(),
}))

const mockedEnsure = vi.mocked(ensureNotificationDelivery)
const mockedClaim = vi.mocked(claimNotificationDeliveryById)
const mockedSend = vi.mocked(sendPushForProfile)

function makeSupabase() {
  return {
    from() {
      return {
        update() {
          return {
            eq() {
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              }
            },
          }
        },
      }
    },
  } as never
}

describe('admin broadcast failure diagnostics', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('does not log raw provider errors when push delivery rejects', async () => {
    const secretMessage =
      'provider rejected https://push.example.test/?token=private-token'

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mockedEnsure.mockResolvedValue({ id: 'delivery-1' } as never)
    mockedClaim.mockResolvedValue({
      id: 'delivery-1',
      dedupeKey: 'delivery-1',
    })
    mockedSend.mockRejectedValue(new Error(secretMessage))

    const result = await sendAdminBroadcastPush(
      makeSupabase(),
      ['profile-1'],
      'broadcast-1',
      {
        title: 'Test',
        body: 'Test body',
        url: '/notifications',
      },
    )

    expect(result.failedProfiles).toBe(1)

    const logged = JSON.stringify(warn.mock.calls)

    expect(logged).not.toContain(secretMessage)
    expect(logged).not.toContain('private-token')
    expect(logged).toContain('"errorName":"Error"')
  })

  it('does not log raw errors when recipient processing fails', async () => {
    const secretMessage =
      'database credentials https://db.example.test/?apikey=private-key'

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mockedEnsure.mockRejectedValue(new Error(secretMessage))

    const result = await sendAdminBroadcastPush(
      makeSupabase(),
      ['profile-2'],
      'broadcast-2',
      {
        title: 'Test',
        body: 'Test body',
        url: '/notifications',
      },
    )

    expect(result.failedProfiles).toBe(1)

    const logged = JSON.stringify(warn.mock.calls)

    expect(logged).not.toContain(secretMessage)
    expect(logged).not.toContain('private-key')
    expect(logged).toContain('"errorName":"Error"')
  })
})
