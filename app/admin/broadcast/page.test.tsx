import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { BroadcastCounts, BroadcastStatus } from '@/lib/broadcast/status'
import AdminBroadcastPage from './page'

vi.mock('@/components/admin/SendIndependenceDayButton', () => ({ SendIndependenceDayButton: () => null }))

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('restores a saved campaign, polls persisted counts, and stops after completion', async () => {
  vi.useFakeTimers()
  const id = '00000000-0000-4000-8000-000000000011'
  const empty: BroadcastCounts = {
    total: 0, queued: 0, processing: 0, accepted: 0, failed: 0, uncertain: 0,
    quota_deferred: 0, unattempted: 0, bookkeeping_errors: 0,
  }
  const campaign: BroadcastStatus = {
    id, batch: 'A', created_at: '2026-11-28T01:00:00Z', completed_at: null,
    email: { ...empty, total: 1, queued: 1 }, push_profiles: empty, push_devices: empty,
    email_next_at: null, push_next_at: null, email_hold: null, push_hold: null,
  }
  window.localStorage.setItem('scholars.admin.broadcast', JSON.stringify({ campaign: id }))
  let polls = 0
  const fetcher = vi.fn(async (path: string) => {
    if (path === '/api/admin/scholarships') return Response.json({ scholarships: [] })
    if (path === '/api/admin/opportunities') return Response.json({ opportunities: [] })
    if (path === '/api/admin/broadcast') return Response.json({
      recipientCount: 1, pushRecipientCount: 0, recent: [{ id, batch: 'A', created_at: campaign.created_at }],
    })
    if (path === '/api/admin/broadcast?id=' + id) {
      polls += 1
      if (polls === 1) return Response.json(campaign)
      return Response.json({
        ...campaign, completed_at: '2026-11-28T01:00:04Z', email: { ...empty, total: 1, accepted: 1 },
      })
    }
    throw new Error('Unexpected route: ' + path)
  })
  vi.stubGlobal('fetch', fetcher)
  await act(async () => { render(<AdminBroadcastPage />) })
  expect(screen.getByRole('heading', { name: /In progress/ })).toBeTruthy()
  expect(polls).toBe(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(4_000) })
  expect(screen.getByRole('heading', { name: /Processing complete/ })).toBeTruthy()
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
  expect(polls).toBe(2)
  expect(fetcher).toHaveBeenCalledWith('/api/admin/broadcast?id=' + id, expect.objectContaining({ cache: 'no-store' }))
})
