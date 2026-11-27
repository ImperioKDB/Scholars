// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import type { BroadcastCounts, BroadcastStatus } from '@/lib/broadcast/status'
import { BroadcastProgress } from './BroadcastProgress'

afterEach(cleanup)

it('reports acceptance, uncertainty, deferral and bookkeeping independently by channel', () => {
  const counts: BroadcastCounts = {
    total: 8, queued: 1, processing: 1, accepted: 2, failed: 1, uncertain: 1,
    quota_deferred: 1, unattempted: 1, bookkeeping_errors: 1,
  }
  const campaign: BroadcastStatus = {
    id: 'synthetic', batch: 'A', created_at: '2026-11-27T12:00:00Z', completed_at: null,
    email: counts, push_profiles: { ...counts, accepted: 3 }, push_devices: { ...counts, accepted: 4 },
    email_hold: 'daily_quota', email_next_at: '2026-11-28T00:00:00Z', push_hold: null, push_next_at: null,
  }
  render(<BroadcastProgress campaign={campaign} />)
  const accepted = screen.getByRole('row', { name: /Provider accepted/ })
  expect(within(accepted).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['2', '3', '4'])
  for (const label of ['Queued', 'Processing', 'Definitively rejected', 'Uncertain', 'Quota deferred', 'Unattempted', 'Bookkeeping errors']) {
    expect(screen.getByRole('rowheader', { name: label })).toBeTruthy()
  }
  expect(screen.getByText(/Daily quota reached/)).toBeTruthy()
  expect(screen.queryByText(/delivered/i)).toBeNull()
})
