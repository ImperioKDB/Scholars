// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readMailtrapReceipt } from './mailtrapReceipts'

afterEach(() => vi.unstubAllGlobals())

describe('Mailtrap email receipt', () => {
  it.each([
    [{ message_id: 'msg-1', status: 'delivered' }, 'delivered'],
    [{ message_id: 'msg-1', status: 'not_delivered', events: [{ event_type: 'bounce' }] }, 'bounced'],
    [{ message_id: 'msg-1', status: 'not_delivered' }, 'failed'],
    [{ message_id: 'msg-1', status: 'opted_out' }, 'suppressed'],
    [{ message_id: 'msg-1', status: 'enqueued' }, null],
    [{ message_id: 'different-id', status: 'delivered' }, null],
  ])('reconciles only a matching terminal Mailtrap log', async (response, status) => {
    const fetch = vi.fn().mockResolvedValue(Response.json(response))
    vi.stubGlobal('fetch', fetch)
    await expect(readMailtrapReceipt('123', 'log-test-token', 'msg-1')).resolves.toBe(status)
    expect(fetch).toHaveBeenCalledWith('https://mailtrap.io/api/accounts/123/email_logs/msg-1',
      expect.objectContaining({ headers: { Authorization: 'Bearer log-test-token' } }))
  })

  it('allows a delayed log to remain accepted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))
    await expect(readMailtrapReceipt('123', 'log-test-token', 'msg-1')).resolves.toBeNull()
  })
})
