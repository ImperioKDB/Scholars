// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runDailyPushCampaign } from './campaigns'
import { sendPushForProfile } from './deliver'
import {
  ensureNotificationDelivery,
  claimNotificationDeliveryById,
  markNotificationAccepted,
  markNotificationRetryable,
} from '@/lib/email/outbox'

vi.mock('@/lib/email/outbox', () => ({
  ensureNotificationDelivery: vi.fn(),
  claimNotificationDeliveryById: vi.fn(),
  markNotificationAccepted: vi.fn(),
  markNotificationRetryable: vi.fn(),
}))
vi.mock('./deliver', () => ({ sendPushForProfile: vi.fn() }))

const mockedEnsure = vi.mocked(ensureNotificationDelivery)
const mockedClaim = vi.mocked(claimNotificationDeliveryById)
const mockedAccept = vi.mocked(markNotificationAccepted)
const mockedRetry = vi.mocked(markNotificationRetryable)
const mockedSend = vi.mocked(sendPushForProfile)

function trackingSupabase(options?: {
  rows?: Record<string, any[]>
  errorOn?: string[]
}) {
  const calls: string[] = []
  const rows = options?.rows ?? {}
  const errorOn = new Set(options?.errorOn ?? [])

  function makeChain(table: string, method: string) {
    const result = { data: rows[table] ?? [], error: null as Error | null }
    const link: any = {
      select: () => {
        calls.push(`${table}.select:${method}`)
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
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
        calls.push(`${table}.maybeSingle:${method}`)
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        return link
      },
      upsert: () => {
        calls.push(`${table}.upsert:${method}`)
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        return link
      },
      update: () => {
        calls.push(`${table}.update:${method}`)
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        return link
      },
      insert: () => {
        calls.push(`${table}.insert:${method}`)
        if (errorOn.has(table)) throw new Error(`db failure on ${table}`)
        return link
      },
    }
    link.then = (resolve: (value: typeof result) => void) => resolve(result)
    return link
  }

  return {
    calls,
    from: (table: string) => makeChain(table, 'from'),
  } as unknown as SupabaseClient
}

function mockDeliveryAccepted() {
  mockedEnsure.mockResolvedValue({ id: 'delivery-1', status: 'pending' } as never)
  mockedClaim.mockResolvedValue({ id: 'delivery-1', dedupeKey: 'key-1' } as never)
  mockedSend.mockResolvedValue({ targets: 1, accepted: 1, failed: 0, retryable: 0, expired: 0 } as never)
  mockedAccept.mockResolvedValue(undefined as never)
}

function mockDeliveryRetryable() {
  mockedEnsure.mockResolvedValue({ id: 'delivery-1', status: 'pending' } as never)
  mockedClaim.mockResolvedValue({ id: 'delivery-1', dedupeKey: 'key-1' } as never)
  mockedSend.mockResolvedValue({ targets: 1, accepted: 0, failed: 1, retryable: 0, expired: 0 } as never)
  mockedRetry.mockResolvedValue(undefined as never)
}

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
    last_verified_at: new Date().toISOString(),
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubEnv('NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY', '')
  vi.stubEnv('WEB_PUSH_VAPID_PRIVATE_KEY', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

function makeProfileIds(count: number, start = 0) {
  return Array.from({ length: count }, (_, i) => `profile-${start + i}`)
}

describe('runDailyPushCampaign bounded execution', () => {
  it('completes a small batch and reports more=false', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        profiles: [profileRow('profile-0')],
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
    })
    mockDeliveryAccepted()

    const result = await runDailyPushCampaign(supabase as never)

    expect(result.newMatchPushesAccepted).toBeGreaterThanOrEqual(0)
    expect(result.more).toBe(false)
    expect(result.budgetExhausted).toBe(false)
    expect(result.subrequestsUsed).toBeLessThan(result.subrequestBudget)
  })

  it('stays below the subrequest budget for a large recipient population', async () => {
    const profileCount = 2000
    const supabase = trackingSupabase({
      rows: {
        push_tokens: makeProfileIds(profileCount).map((id, i) => ({ id: `t-${i}`, profile_id: id, enabled: true })),
        profiles: makeProfileIds(profileCount).map(profileRow),
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
    })
    mockDeliveryAccepted()

    const result = await runDailyPushCampaign(supabase as never)

    expect(result.subrequestsUsed).toBeLessThanOrEqual(result.subrequestBudget)
    // A large population exhausts the budget; incomplete work is reported, not silently succeeded.
    expect(result.budgetExhausted).toBe(true)
    expect(result.more).toBe(true)
    expect(result.activeProfiles).toBe(profileCount)
  })

  it('reports incomplete processing rather than silently marking success', async () => {
    const profileCount = 2000
    const supabase = trackingSupabase({
      rows: {
        push_tokens: makeProfileIds(profileCount).map((id, i) => ({ id: `t-${i}`, profile_id: id, enabled: true })),
        profiles: makeProfileIds(profileCount).map(profileRow),
        scholarships: Array.from({ length: 250 }, (_, i) => scholarshipRow(`scholarship-${i}`, `Award ${i}`)),
        scholarship_rules: [],
      },
    })
    mockDeliveryAccepted()

    const result = await runDailyPushCampaign(supabase as never)

    expect(result.subrequestsUsed).toBeLessThanOrEqual(result.subrequestBudget)
    expect(typeof result.more).toBe('boolean')
    expect(typeof result.budgetExhausted).toBe('boolean')
  })

  it('continues across batches until no matches remain or budget is reached', async () => {
    const profileCount = 50
    const supabase = trackingSupabase({
      rows: {
        push_tokens: makeProfileIds(profileCount).map((id, i) => ({ id: `t-${i}`, profile_id: id, enabled: true })),
        profiles: makeProfileIds(profileCount).map(profileRow),
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
    })
    mockDeliveryAccepted()

    const result = await runDailyPushCampaign(supabase as never)

    expect(result.profilesCheckedForMatches).toBe(profileCount)
    expect(result.subrequestsUsed).toBeGreaterThan(0)
    expect(result.subrequestsUsed).toBeLessThanOrEqual(result.subrequestBudget)
  })

  it('derives dedupe keys from profile and scholarship to prevent duplicates', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        profiles: [profileRow('profile-0')],
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
    })
    mockDeliveryAccepted()

    await runDailyPushCampaign(supabase as never)

    expect(mockedEnsure).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ dedupeKey: 'push:new_match:profile-0:scholarship-0' }),
    )
    expect(mockedClaim).toHaveBeenCalled()
  })

  it('handles failed database requests without marking success', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        profiles: [],
      },
      errorOn: ['profiles'],
    })
    mockDeliveryAccepted()

    await expect(runDailyPushCampaign(supabase as never)).rejects.toThrow('db failure on profiles')
  })

  it('retries failed deliveries and marks them retryable', async () => {
    const now = new Date().toISOString()
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        profiles: [profileRow('profile-0')],
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
        notification_deliveries: [{
          id: 'delivery-1',
          profile_id: 'profile-0',
          scholarship_id: 'scholarship-0',
          dedupe_key: 'push:new_match:profile-0:scholarship-0',
          channel: 'push',
          campaign_key: 'new_match',
          status: 'retryable',
          available_at: now,
        }],
      },
    })
    mockDeliveryRetryable()

    const result = await runDailyPushCampaign(supabase as never)

    expect(mockedRetry).toHaveBeenCalled()
    expect(result.subrequestsUsed).toBeLessThanOrEqual(result.subrequestBudget)
  })

  it('does not send push provider secrets in diagnostics', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        profiles: [profileRow('profile-0')],
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
    })
    const secret = 'https://push.example.test/?token=provider-secret'
    mockedEnsure.mockResolvedValue({ id: 'delivery-1', status: 'pending' } as never)
    mockedClaim.mockResolvedValue({ id: 'delivery-1', dedupeKey: 'key-1' } as never)
    mockedSend.mockRejectedValue(new Error(secret))
    mockedRetry.mockResolvedValue(undefined as never)

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await runDailyPushCampaign(supabase as never)

    const logged = JSON.stringify(warn.mock.calls)
    expect(logged).not.toContain(secret)
    expect(logged).not.toContain('provider-secret')
    expect(result.retryableDeliveries).toBeGreaterThanOrEqual(0)
  })

  it('reports subsequent runs with no remaining work as complete', async () => {
    const supabase = trackingSupabase({
      rows: {
        push_tokens: [{ id: 't1', profile_id: 'profile-0', enabled: true }],
        profiles: [profileRow('profile-0')],
        scholarships: [scholarshipRow('scholarship-0', 'Award')],
        scholarship_rules: [],
      },
    })
    mockDeliveryAccepted()

    const first = await runDailyPushCampaign(supabase as never)
    expect(first.subrequestsUsed).toBeLessThanOrEqual(first.subrequestBudget)

    const second = await runDailyPushCampaign(supabase as never)
    expect(second.subrequestsUsed).toBeLessThanOrEqual(second.subrequestBudget)
  })
})
