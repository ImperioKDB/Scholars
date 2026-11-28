// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runDailyPushCampaign } from '@/lib/push/campaigns'
import { createServiceClient } from '@/lib/supabase/service'
import { deliverDeadlineReminders, prepareDeadlineReminders } from '@/lib/deadlines/engine'
import { GET, POST } from './route'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/push/campaigns', () => ({ runDailyPushCampaign: vi.fn() }))
vi.mock('@/lib/deadlines/engine', () => ({
  deliverDeadlineReminders: vi.fn(),
  prepareDeadlineReminders: vi.fn(),
}))

function request(token?: string, task?: string) {
  return new Request(`https://example.test/api/cron/deadline-check${task ? `?task=${task}` : ''}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('deadline cron', () => {
  it('fails closed before doing work for a missing secret or incorrect credentials', async () => {
    vi.stubEnv('CRON_SECRET', undefined)
    expect((await GET(request('test-only'))).status).toBe(401)
    vi.stubEnv('CRON_SECRET', 'test-only')
    expect((await GET(request())).status).toBe(401)
    expect((await GET(request('wrong'))).status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('validates the action and routes authorized work to only that channel', async () => {
    vi.stubEnv('CRON_SECRET', 'test-only')
    expect((await POST(request('test-only', 'invalid'))).status).toBe(400)
    vi.mocked(createServiceClient).mockReturnValue({} as never)
    vi.mocked(deliverDeadlineReminders).mockResolvedValue({ accepted: 1, more: false } as never)
    expect((await GET(request('test-only', 'push'))).status).toBe(400)
    const response = await POST(request('test-only', 'push'))
    expect(await response.json()).toEqual({ accepted: 1, more: false })
    expect(deliverDeadlineReminders).toHaveBeenCalledWith({}, 'push')
    expect(prepareDeadlineReminders).not.toHaveBeenCalled()
  })

  it('keeps unqualified legacy GET on daily maintenance only', async () => {
    vi.stubEnv('CRON_SECRET', 'test-only')
    const rpc = vi.fn().mockResolvedValue({ data: [{ flagged_count: 2 }], error: null })
    vi.mocked(createServiceClient).mockReturnValue({ rpc } as never)
    vi.mocked(runDailyPushCampaign).mockResolvedValue({ newMatchPushesAccepted: 3 } as never)
    expect(await (await GET(request('test-only'))).json()).toMatchObject({
      deadline_flags: 2, push_campaign: { newMatchPushesAccepted: 3 },
    })
    expect(rpc).toHaveBeenCalledWith('flag_expired_opportunities')
    expect(runDailyPushCampaign).toHaveBeenCalledWith({ rpc }, true)
    expect(prepareDeadlineReminders).not.toHaveBeenCalled()
  })

  it('continues existing windows without starting maintenance or flagging opportunities', async () => {
    vi.stubEnv('CRON_SECRET', 'test-only')
    const rpc = vi.fn()
    vi.mocked(createServiceClient).mockReturnValue({ rpc } as never)
    vi.mocked(runDailyPushCampaign).mockResolvedValue({ phase: 'busy', more: true })
    expect(await (await POST(request('test-only', 'new_match'))).json()).toEqual({
      push_campaign: { phase: 'busy', more: true, incomplete: true },
    })
    expect(runDailyPushCampaign).toHaveBeenCalledWith({ rpc })
    expect(rpc).not.toHaveBeenCalled()
  })

})
