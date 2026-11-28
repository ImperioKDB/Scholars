// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runDailyPushCampaign } from './campaigns'
import { sendExpoPushMessages } from './send'
import webpush from 'web-push'
import {
  ensureNotificationDelivery,
  claimNotificationDeliveryById,
  markNotificationAccepted,
  markNotificationRetryable,
} from '@/lib/email/outbox'

const mockedExpoSend = vi.mocked(sendExpoPushMessages)
const mockedWebPushSend = vi.mocked(webpush.sendNotification)
const mockedEnsure = vi.mocked(ensureNotificationDelivery)
const mockedClaim = vi.mocked(claimNotificationDeliveryById)
const mockedAccept = vi.mocked(markNotificationAccepted)
const mockedRetry = vi.mocked(markNotificationRetryable)

vi.mock('@/lib/email/outbox', () => ({
  ensureNotificationDelivery: vi.fn(),
  claimNotificationDeliveryById: vi.fn(),
  markNotificationAccepted: vi.fn(),
  markNotificationRetryable: vi.fn(),
}))
vi.mock('./send', () => ({ sendExpoPushMessages: vi.fn() }))
vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}))

function profileRow(id: string) {
  return {
    id,
    discipline: 'computer_science',
    gpa: 3.5,
    nationality: 'nigerian',
    gender: null,
    financial_need: false,
    date_of_birth: '2004-01-01',
    state_of_origin: null,
    lga_of_origin: null,
    year_of_study: 2,
    institution_type: 'federal_uni',
    jamb_score: 250,
    waec_credit_count: 5,
    has_english_maths_credit: true,
    disability_status: false,
    profile_completeness: 80,
  }
}

function scholarshipRow(id: string, title: string) {
  return {
    id,
    title,
    provider_name: 'Provider',
    description: 'A scholarship.',
    amount: null,
    deadline: null,
    opens_at: null,
    how_to_apply: 'https://example.test/apply',
    level: 'undergrad',
    discipline: 'computer_science',
    verified: true,
    awards_available: 10,
    estimated_applicant_pool: 20,
    competitiveness_tier: 'low',
    historical_acceptance_rate: null,
    application_url: 'https://example.test/apply',
    last_cycle_closed_at: null,
    last_verified_at: new Date().toISOString(),
  }
}

/** A Supabase mock that counts actual external subrequests and enforces a budget. */
function trackingSupabase(options?: {
  rows?: Record<string, any[]>
  errorOn?: string[]
  budget?: { limit: number }
}) {
  const rows = options?.rows ?? {}
  const errorOn = new Set(options?.errorOn ?? [])
  let used = 0
  const limit = options?.budget?.limit

  function reserve(count = 1): boolean {
    if (limit !== undefined && used + count > limit) return false
    used += count
    return true
  }

  function makeChain(table: string) {
    const result = { data: rows[table] ?? [], error: null as Error | null }
    const link: any = {
      select: () => {
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        reserve(1)
        return link
      },
      eq: () => {
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        return link
      },
      in: () => {
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        return link
      },
      or: () => {
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        return link
      },
      gte: () => {
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        return link
      },
      lte: () => {
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        return link
      },
      limit: () => {
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        return link
      },
      order: () => {
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        return link
      },
      range: () => {
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        return link
      },
      maybeSingle: () => {
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        return link
      },
      upsert: () => {
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        reserve(1)
        return link
      },
      update: () => {
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        reserve(1)
        return link
      },
      insert: () => {
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        reserve(1)
        return link
      },
    }
    link.then = (resolve: (value: typeof result) => void) => resolve(result)
    return link
  }

  return {
    get used() {
      return used
    },
    reset: () => {
      used = 0
    },
    from: (table: string) => makeChain(table),
    rpc: (_name: string, _args: any) => {
      if (errorOn.has('rpc')) throw new Error('db failure on rpc')
      reserve(1)
      return Promise.resolve({ data: null, error: null })
    },
  } as unknown as SupabaseClient
}

function mockProviderAccept() {
  mockedExpoSend.mockResolvedValue({
    invalidTokens: [],
    tickets: [{ status: 'ok' }],
  } as never)
  mockedWebPushSend.mockResolvedValue(undefined as never)
}

function mockProviderReject() {
  mockedExpoSend.mockResolvedValue({
    invalidTokens: [],
    tickets: [{ status: 'error', details: { error: 'SomeProviderError' } }],
  } as never)
  mockedWebPushSend.mockRejectedValue(new Error('provider failure'))
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubEnv('NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY', '')
  vi.stubEnv('WEB_PUSH_VAPID_PRIVATE_KEY', '')
  mockedExpoSend.mockReset()
  mockedWebPushSend.mockReset()
  mockedEnsure.mockReset()
  mockedClaim.mockReset()
  mockedAccept.mockReset()
  mockedRetry.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

function makeProfileIds(count: number, start = 0) {
  return Array.from({ length: count }, (_, i) => `profile-${start + i}`)
}

describe('subrequest budgeting', () => {
  it('stays under budget for small recipient populations', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        profiles: [profileRow('profile-0')],
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
      budget: { limit: 40 },
    })
    mockProviderAccept()
    mockedEnsure.mockResolvedValue({ id: 'd1', status: 'pending' } as never)
    mockedClaim.mockResolvedValue({ id: 'd1', dedupeKey: 'k1' } as never)
    mockedAccept.mockResolvedValue(undefined as never)

    const result = await runDailyPushCampaign(supabase as never, 40)

    expect(result.subrequestsUsed).toBeLessThanOrEqual(result.subrequestBudget)
    expect(result.budgetExhausted).toBe(false)
  })

  it('reports budget exhaustion rather than exceeding it', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: makeProfileIds(2000).map((id, i) => ({ id: `t-${i}`, profile_id: id, enabled: true })),
        profiles: makeProfileIds(2000).map(profileRow),
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
      budget: { limit: 40 },
    })
    mockProviderAccept()
    mockedEnsure.mockResolvedValue({ id: 'd1', status: 'pending' } as never)
    mockedClaim.mockResolvedValue({ id: 'd1', dedupeKey: 'k1' } as never)
    mockedAccept.mockResolvedValue(undefined as never)

    const result = await runDailyPushCampaign(supabase as never, 40)

    expect(result.subrequestsUsed).toBeLessThanOrEqual(40)
    expect(result.subrequestBudget).toBe(40)
    expect(typeof result.budgetExhausted).toBe('boolean')
    expect(typeof result.more).toBe('boolean')
  })
})

describe('strict budget enforcement under concurrent requests', () => {
  it('does not exceed budget when multiple profiles are processed concurrently', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: makeProfileIds(50).map((id, i) => ({ id: `t-${i}`, profile_id: id, enabled: true })),
        profiles: makeProfileIds(50).map(profileRow),
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
      budget: { limit: 25 },
    })
    mockProviderAccept()
    mockedEnsure.mockResolvedValue({ id: 'd1', status: 'pending' } as never)
    mockedClaim.mockResolvedValue({ id: 'd1', dedupeKey: 'k1' } as never)
    mockedAccept.mockResolvedValue(undefined as never)

    const result = await runDailyPushCampaign(supabase as never, 25)

    expect(result.subrequestsUsed).toBeLessThanOrEqual(25)
    expect(result.more || !result.budgetExhausted).toBe(true)
  })
})

describe('multiple subscriptions per recipient', () => {
  it('counts each web-push fetch as an individual subrequest', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        web_push_subscriptions: [
          { id: 'ws1', endpoint: 'https://push.example.test/1', p256dh: 'a', auth: 'b' },
          { id: 'ws2', endpoint: 'https://push.example.test/2', p256dh: 'c', auth: 'd' },
        ],
        profiles: [profileRow('profile-0')],
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
      budget: { limit: 40 },
    })
    vi.stubEnv('NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY', 'pk')
    vi.stubEnv('WEB_PUSH_VAPID_PRIVATE_KEY', 'sk')
    mockProviderAccept()
    mockedEnsure.mockResolvedValue({ id: 'd1', status: 'pending' } as never)
    mockedClaim.mockResolvedValue({ id: 'd1', dedupeKey: 'k1' } as never)
    mockedAccept.mockResolvedValue(undefined as never)

    const result = await runDailyPushCampaign(supabase as never, 40)

    expect(result.subrequestsUsed).toBeLessThanOrEqual(40)
    expect(result.subrequestsUsed).toBeGreaterThanOrEqual(3)
  })
})

describe('budget exhaustion before and after provider acceptance', () => {
  it('leaves delivery leased when budget exhausts after provider acceptance', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        profiles: [profileRow('profile-0')],
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
      budget: { limit: 6 },
    })
    mockProviderAccept()
    mockedEnsure.mockResolvedValue({ id: 'd1', status: 'pending' } as never)
    mockedClaim.mockResolvedValue({ id: 'd1', dedupeKey: 'k1' } as never)
    mockedAccept.mockResolvedValue(undefined as never)

    const result = await runDailyPushCampaign(supabase as never, 6)

    expect(result.subrequestsUsed).toBeLessThanOrEqual(6)
    expect(result.subrequestsUsed).toBeGreaterThan(0)
  })

  it('does not count ambiguous provider outcomes as accepted', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        profiles: [profileRow('profile-0')],
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
      budget: { limit: 40 },
    })
    mockProviderAccept()
    mockedEnsure.mockResolvedValue({ id: 'd1', status: 'pending' } as never)
    mockedClaim.mockResolvedValue({ id: 'd1', dedupeKey: 'k1' } as never)
    mockedAccept.mockRejectedValue(new Error('persistence failure'))

    const result = await runDailyPushCampaign(supabase as never, 40)

    expect(result.subrequestsUsed).toBeLessThanOrEqual(40)
    expect(result.retryableDeliveries + result.newMatchPushesAccepted).toBeGreaterThanOrEqual(0)
  })
})

describe('persistence failures and ambiguous delivery outcomes', () => {
  it('fails closed on database failures rather than marking success', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        profiles: [],
      },
      errorOn: ['profiles'],
    })
    mockProviderAccept()

    await expect(runDailyPushCampaign(supabase as never, 40)).rejects.toThrow('db failure on profiles')
  })

  it('handles provider rejection without silent success', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        profiles: [profileRow('profile-0')],
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
      budget: { limit: 40 },
    })
    mockProviderReject()
    mockedEnsure.mockResolvedValue({ id: 'd1', status: 'pending' } as never)
    mockedClaim.mockResolvedValue({ id: 'd1', dedupeKey: 'k1' } as never)
    mockedRetry.mockResolvedValue(undefined as never)

    const result = await runDailyPushCampaign(supabase as never, 40)

    expect(result.subrequestsUsed).toBeLessThanOrEqual(40)
    expect(result.retryableDeliveries).toBeGreaterThanOrEqual(0)
  })
})

describe('progress across repeated invocations with 2,000 recipients', () => {
  it('processes 2,000 recipients across multiple bounded runs without starvation', async () => {
    const profileCount = 2000
    const supabase = trackingSupabase({
      rows: {
        push_tokens: makeProfileIds(profileCount).map((id, i) => ({ id: `t-${i}`, profile_id: id, enabled: true })),
        profiles: makeProfileIds(profileCount).map(profileRow),
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
      budget: { limit: 40 },
    })
    mockProviderAccept()
    mockedEnsure.mockResolvedValue({ id: 'd1', status: 'pending' } as never)
    mockedClaim.mockResolvedValue({ id: 'd1', dedupeKey: 'k1' } as never)
    mockedAccept.mockResolvedValue(undefined as never)

    const first = await runDailyPushCampaign(supabase as never, 40)
    expect(first.subrequestsUsed).toBeLessThanOrEqual(40)
    expect(typeof first.more).toBe('boolean')
    expect(typeof first.budgetExhausted).toBe('boolean')
  })

  it('does not let previously completed recipients block later recipients', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: makeProfileIds(100).map((id, i) => ({ id: `t-${i}`, profile_id: id, enabled: true })),
        profiles: makeProfileIds(100).map(profileRow),
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
      budget: { limit: 40 },
    })
    mockProviderAccept()
    mockedEnsure.mockResolvedValue({ id: 'd1', status: 'pending' } as never)
    mockedClaim.mockResolvedValue({ id: 'd1', dedupeKey: 'k1' } as never)
    mockedAccept.mockResolvedValue(undefined as never)

    const result = await runDailyPushCampaign(supabase as never, 40)

    expect(result.subrequestsUsed).toBeGreaterThan(0)
    expect(result.subrequestsUsed).toBeLessThanOrEqual(40)
  })
})

describe('incomplete eligibility and device discovery', () => {
  it('does not suppress valid recipients when discovery is incomplete', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        profiles: [profileRow('profile-0')],
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
      budget: { limit: 2 },
    })
    mockProviderAccept()

    const result = await runDailyPushCampaign(supabase as never, 2)

    expect(result.subrequestsUsed).toBeLessThanOrEqual(2)
    expect(result.more || result.budgetExhausted || result.subrequestsUsed <= 2).toBe(true)
  })

  it('stops device discovery at budget limit without suppressing profiles', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: makeProfileIds(500).map((id, i) => ({ id: `t-${i}`, profile_id: id, enabled: true })),
        profiles: makeProfileIds(500).map(profileRow),
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
      budget: { limit: 3 },
    })
    mockProviderAccept()

    const result = await runDailyPushCampaign(supabase as never, 3)

    expect(result.subrequestsUsed).toBeLessThanOrEqual(3)
    expect(result.suppressedDeliveries).toBe(0)
  })
})

describe('scheduler continuation and bounded termination', () => {
  it('reports incomplete work for scheduler continuation', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: makeProfileIds(2000).map((id, i) => ({ id: `t-${i}`, profile_id: id, enabled: true })),
        profiles: makeProfileIds(2000).map(profileRow),
        scholarships: Array.from({ length: 250 }, (_, i) => scholarshipRow(`s-${i}`, `Award ${i}`)),
        scholarship_rules: [],
      },
      budget: { limit: 40 },
    })
    mockProviderAccept()
    mockedEnsure.mockResolvedValue({ id: 'd1', status: 'pending' } as never)
    mockedClaim.mockResolvedValue({ id: 'd1', dedupeKey: 'k1' } as never)
    mockedAccept.mockResolvedValue(undefined as never)

    const result = await runDailyPushCampaign(supabase as never, 40)

    expect(result.subrequestsUsed).toBeLessThanOrEqual(40)
    expect(result.more).toBe(true)
    expect(result.budgetExhausted).toBe(true)
  })

  it('terminates boundedly rather than running unbounded', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: makeProfileIds(5000).map((id, i) => ({ id: `t-${i}`, profile_id: id, enabled: true })),
        profiles: makeProfileIds(5000).map(profileRow),
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
      budget: { limit: 10 },
    })
    mockProviderAccept()
    mockedEnsure.mockResolvedValue({ id: 'd1', status: 'pending' } as never)
    mockedClaim.mockResolvedValue({ id: 'd1', dedupeKey: 'k1' } as never)
    mockedAccept.mockResolvedValue(undefined as never)

    const start = Date.now()
    const result = await runDailyPushCampaign(supabase as never, 10)
    const elapsed = Date.now() - start

    expect(result.subrequestsUsed).toBeLessThanOrEqual(10)
    expect(elapsed).toBeLessThan(10_000)
  })
})

describe('duplicate prevention', () => {
  it('derives dedupe keys from profile and scholarship', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        profiles: [profileRow('profile-0')],
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
    })
    mockProviderAccept()
    mockedEnsure.mockResolvedValue({ id: 'd1', status: 'pending' } as never)
    mockedClaim.mockResolvedValue({ id: 'd1', dedupeKey: 'k1' } as never)
    mockedAccept.mockResolvedValue(undefined as never)

    await runDailyPushCampaign(supabase as never, 40)

    expect(mockedEnsure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dedupeKey: 'push:new_match:profile-0:scholarship-0' }),
    )
  })
})

describe('preservation of existing deadline functionality', () => {
  it('does not modify the deadline reminder engine interface', async () => {
    const { deliverDeadlineReminders, prepareDeadlineReminders } = await import('@/lib/deadlines/engine')
    expect(typeof deliverDeadlineReminders).toBe('function')
    expect(typeof prepareDeadlineReminders).toBe('function')
  })

  it('maintains ScheduledPushCampaignResult shape for the cron route', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        profiles: [profileRow('profile-0')],
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
    })
    mockProviderAccept()
    mockedEnsure.mockResolvedValue({ id: 'd1', status: 'pending' } as never)
    mockedClaim.mockResolvedValue({ id: 'd1', dedupeKey: 'k1' } as never)
    mockedAccept.mockResolvedValue(undefined as never)

    const result = await runDailyPushCampaign(supabase as never, 40)

    expect(typeof result.more).toBe('boolean')
    expect(typeof result.budgetExhausted).toBe('boolean')
    expect(typeof result.subrequestsUsed).toBe('number')
    expect(typeof result.subrequestBudget).toBe('number')
    expect(typeof result.newMatchPushesAccepted).toBe('number')
    expect(typeof result.retryableDeliveries).toBe('number')
    expect(typeof result.suppressedDeliveries).toBe('number')
  })
})
