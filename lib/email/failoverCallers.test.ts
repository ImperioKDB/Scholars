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

  it('broadcast and campaign routes use recipient-scoped keys and no automatic attempt loop', () => {
    const broadcast = source('app/api/admin/broadcast/route.ts')
    const independence = source('app/api/admin/independence-day/route.ts')
    expect(broadcast).toContain('`broadcast/${broadcastId}/${r.id}`')
    expect(independence).toContain('`independence-day/${campaignId}/${recipient.id}`')
    for (const text of [broadcast, independence]) {
      expect(text).not.toContain('MAX_ATTEMPTS')
      expect(text).not.toContain('sendWithRetry')
      expect(text).toContain('provider_message')
    }
  })
})
