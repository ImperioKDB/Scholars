// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushForProfile } from '@/lib/push/deliver'
import { getDeadlineEmailConfig, sendDeadlineEmail } from './mailtrap'
import { deliverDeadlineReminders, prepareDeadlineReminders } from './engine'

vi.mock('@/lib/push/deliver', () => ({ sendPushForProfile: vi.fn() }))
vi.mock('./mailtrap', () => ({ getDeadlineEmailConfig: vi.fn(), sendDeadlineEmail: vi.fn() }))

const item = {
  id: 'delivery',
  profile_id: 'profile',
  scholarship_id: 'scholarship',
  opportunity_id: null,
  full_name: 'Example',
  email: 'student@example.test',
  title: 'Example award',
  deadline_date: '2099-11-27',
  deadline_stage: 'last_24h',
  attempts: 1,
  lease_until: '2026-11-27T09:10:00Z',
}

function serviceWithBundles(bundles: Record<string, (typeof item)[]>, ownsLease = true) {
  const rpc = vi.fn(async (name: string, args) => {
    if (name === 'prepare_deadline_reminders') return { data: { generated: 3, inboxDelivered: 1, capacityReached: false } }
    const bundle = bundles[args.p_channel]
    delete bundles[args.p_channel]
    return { data: bundle ?? [] }
  })
  const eq = vi.fn()
  const payloads: Record<string, unknown>[] = []
  const from = vi.fn(() => ({
    update: (payload: Record<string, unknown>) => {
      payloads.push(payload)
      return { in: (_column: string, ids: string[]) => ({ eq: () => ({ eq: (...args: unknown[]) => {
        eq(...args)
        return { select: () => ({ data: ownsLease ? ids.map((id) => ({ id })) : [], error: null }) }
      } }) }) }
    },
  }))
  return { service: { rpc, from } as unknown as SupabaseClient, rpc, payloads, eq }
}

beforeEach(() => {
  vi.stubEnv('DEADLINE_EMAIL_ENABLED', 'true')
  vi.mocked(getDeadlineEmailConfig).mockReturnValue({
    token: 'test-only', fromEmail: 'test@example.test', fromName: 'Scholars', appOrigin: 'https://example.test',
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('deadline reminder channels', () => {
  it('keeps push accepted when email fails and fences results by lease', async () => {
    const { service, payloads, eq } = serviceWithBundles({ email: [item], push: [item] })
    vi.mocked(sendDeadlineEmail).mockResolvedValue({ status: 'unknown', code: 'mailtrap_unknown' })
    vi.mocked(sendPushForProfile).mockResolvedValue({ targets: 1, accepted: 1, failed: 0, retryable: 0, expired: 0 })
    const [email, push] = await Promise.all([
      deliverDeadlineReminders(service, 'email'),
      deliverDeadlineReminders(service, 'push'),
    ])
    expect(email.unknown).toBe(1)
    expect(push.accepted).toBe(1)
    expect(payloads.map((row) => row.status)).toEqual(expect.arrayContaining(['unknown', 'accepted']))
    expect(eq).toHaveBeenCalledWith('lease_until', item.lease_until)
  })

  it.each([true, false])('ignores a delayed worker outcome after lease turnover (accepted=%s)', async (accepted) => {
    const { service, eq } = serviceWithBundles({ push: [item] }, false)
    vi.mocked(sendPushForProfile).mockResolvedValue({
      targets: 1, accepted: Number(accepted), failed: Number(!accepted), retryable: Number(!accepted), expired: 0,
    })
    expect(await deliverDeadlineReminders(service, 'push')).toMatchObject({ processed: 1, accepted: 0, retryable: 0 })
    expect(eq).toHaveBeenCalledWith('lease_until', item.lease_until)
  })

  it('bounds a push request to three bundles even at full load', async () => {
    const { service, rpc } = serviceWithBundles({})
    rpc.mockResolvedValue({ data: [item] })
    vi.mocked(sendPushForProfile).mockResolvedValue({ targets: 1, accepted: 1, failed: 0, retryable: 0, expired: 0 })
    expect(await deliverDeadlineReminders(service, 'push')).toMatchObject({ processed: 3, more: true })
    expect(rpc).toHaveBeenCalledTimes(3)
  })

  it('defers temporary push failure and stops after the third attempt', async () => {
    const { service, payloads } = serviceWithBundles({ push: [item, { ...item, id: 'other', attempts: 3 }] })
    vi.mocked(sendPushForProfile).mockResolvedValue({ targets: 1, accepted: 0, failed: 1, retryable: 1, expired: 0 })
    const result = await deliverDeadlineReminders(service, 'push')
    expect(result).toMatchObject({ retryable: 1, dead_letter: 1 })
    expect(payloads[0]).toHaveProperty('available_at')
  })

  it('suppresses a push when the deadline passes after the claim', async () => {
    const { service } = serviceWithBundles({ push: [{ ...item, deadline_date: '2000-01-01' }] })
    expect((await deliverDeadlineReminders(service, 'push')).suppressed).toBe(1)
    expect(sendPushForProfile).not.toHaveBeenCalled()
  })

  it('leaves the inbox enabled with incomplete Mailtrap configuration', async () => {
    const { service, rpc } = serviceWithBundles({})
    vi.mocked(getDeadlineEmailConfig).mockReturnValue(null)
    expect(await prepareDeadlineReminders(service)).toEqual({ generated: 3, inboxDelivered: 1, capacityReached: false, emailEnabled: true, emailConfigured: false })
    expect(rpc).toHaveBeenCalledWith('prepare_deadline_reminders', expect.objectContaining({
      p_email: false, p_early: 7, p_push: 3, p_passed_email: false,
    }))
    expect((await deliverDeadlineReminders(service, 'email')).processed).toBe(0)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
