import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')

describe('email failover caller safety', () => {
  it('digest and profile nudges pass notification IDs and use terminal outbox outcomes', () => {
    const digest = source('lib/email/digest.ts')
    const nudges = source('lib/email/profileNudges.ts')
    for (const text of [digest, nudges]) {
      expect(text).toContain('idempotencyKey:')
      expect(text).toContain('delivery.id')
      expect(text).toContain('markNotificationDeadLetter')
      expect(text).toContain('markNotificationFailed')
      expect(text).not.toContain('markNotificationRetryable')
    }
    expect(digest).toContain('markNotificationAccepted(supabase, delivery.id, res.messageId)')
    expect(nudges).toContain('markNotificationAccepted(supabase, delivery.id, res.messageId)')
  })

  it('broadcast workers and the Independence Day route retain recipient-scoped keys', () => {
    const broadcast = source('lib/broadcast/providers.ts')
    const worker = source('lib/broadcast/worker.ts')
    const independence = source('app/api/admin/independence-day/route.ts')
    expect(broadcast).toContain("const idempotencyKey = 'broadcast/' + campaign + '/' + target.id")
    expect(worker).toContain('p_provider_id: outcome.messageId ?? null')
    expect(independence).toContain('`independence-day/${campaignId}/${recipient.id}`')
    expect(independence).toContain('provider_message')
    for (const text of [broadcast, worker, independence]) {
      expect(text).not.toContain('MAX_ATTEMPTS')
      expect(text).not.toContain('sendWithRetry')
    }
  })
})
