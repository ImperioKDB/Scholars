import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runDailyPushCampaign } from './campaigns'
import { sendPushForProfile } from './deliver'

vi.mock('./deliver', () => ({ sendPushForProfile: vi.fn() }))

const item = { id: 'delivery', title: 'An award' }
const noDevice = { targets: 0, accepted: 0, retryable: 0, failed: 0, expired: 0 }
const finish = { more: false, suppressedDeliveries: 0, retryableDeliveries: 0, unknownDeliveries: 0 }

function client(data: Record<string, unknown>) {
  const rpc = vi.fn((name: string, _args: Record<string, unknown>) => ({
    retry: (enabled: boolean) => {
      expect(enabled).toBe(false)
      const result = data[name]
      return result instanceof Error ? { error: result } : { data: result }
    },
  }))
  return { service: { rpc } as unknown as Parameters<typeof runDailyPushCampaign>[0], rpc }
}

describe('new-match campaign orchestration', () => {
  beforeEach(() => vi.resetAllMocks())

  it('does no delivery or discovery work when the shared lease is held', async () => {
    const { service, rpc } = client({ begin_new_match_step: { phase: 'busy' } })
    await expect(runDailyPushCampaign(service, true)).resolves.toEqual({ phase: 'busy', more: true })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('begin_new_match_step', { p_start_window: true, p_owner: expect.any(String) })
    expect(sendPushForProfile).not.toHaveBeenCalled()
  })

  it('commits an empty discovery page without claiming delivery', async () => {
    const { service, rpc } = client({
      begin_new_match_step: { phase: 'discovery', day: '2026-11-28', profiles: [], scholarships: [], rules: [] },
      commit_new_match_page: { more: true, queued: 0 },
    })
    await expect(runDailyPushCampaign(service)).resolves.toMatchObject({ phase: 'discovery', profilesCheckedForMatches: 0 })
    const owner = rpc.mock.calls[0][1].p_owner
    expect(rpc.mock.calls.slice(1)).toEqual([
      ['commit_new_match_page', { p_owner: owner, p_day: '2026-11-28', p_matches: [] }],
    ])
  })

  it('persists acceptance through the same owner and propagates persistence failures without sending again', async () => {
    vi.mocked(sendPushForProfile).mockResolvedValue({ ...noDevice, targets: 1, accepted: 1 })
    const { service, rpc } = client({
      begin_new_match_step: { phase: 'delivery' },
      claim_new_match_batch: { bundles: [{ profile_id: 'profile', items: [item] }] },
      finish_new_match_batch: new Error('write lost'),
    })
    await expect(runDailyPushCampaign(service)).rejects.toThrow('write lost')
    const owner = rpc.mock.calls[0][1].p_owner
    expect(rpc.mock.calls.slice(1)).toEqual([
      ['claim_new_match_batch', { p_owner: owner }],
      ['finish_new_match_batch', { p_owner: owner, p_outcomes: [{ ids: [item.id], status: 'accepted' }] }],
    ])
    expect(sendPushForProfile).toHaveBeenCalledOnce()
    expect(sendPushForProfile).toHaveBeenCalledWith(service, 'profile', expect.any(Object), { deviceLimit: 4 })
  })

  it.each([
    { summary: noDevice, web: false, status: 'suppressed' },
    { summary: noDevice, web: true, status: 'retryable' },
    { summary: { ...noDevice, failed: 1 }, web: false, status: 'retryable' },
    { summary: { ...noDevice, failed: 1, uncertain: 1 }, web: false, status: 'unknown' },
    { summary: { ...noDevice, accepted: 1, uncertain: 1 }, web: false, status: 'accepted' },
  ])('records $status for provider summary $summary and web opt-in $web', async ({ summary, web, status }) => {
    const { service, rpc } = client({
      begin_new_match_step: { phase: 'delivery' },
      claim_new_match_batch: { bundles: [{ profile_id: 'profile', web_enabled: web, items: [item] }] },
      finish_new_match_batch: finish,
    })
    vi.stubEnv('WEB_PUSH_VAPID_PRIVATE_KEY', '')
    try {
      vi.mocked(sendPushForProfile).mockResolvedValue(summary)
      await runDailyPushCampaign(service)
      expect(rpc.mock.calls[2][1].p_outcomes).toEqual([{ ids: [item.id], status }])
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
