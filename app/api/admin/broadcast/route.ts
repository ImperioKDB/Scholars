import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertAdmin } from '@/lib/admin/guard'
import { BroadcastBudget, BroadcastDatabaseError, broadcastDatabase, readBoundedJson } from '@/lib/broadcast/transport'
import type { BroadcastOverview, BroadcastStatus } from '@/lib/broadcast/status'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const uuid = z.string().uuid().transform((value) => value.toLowerCase())
const listingIds = z.array(uuid).max(10).transform((ids) => [...new Set(ids)])
const bodySchema = z.object({
  broadcast_id: uuid,
  scholarship_ids: listingIds.default([]),
  opportunity_ids: listingIds.default([]),
  batch: z.enum(['A', 'B', 'C']).optional(),
}).refine((body) => {
  const listings = body.scholarship_ids.length + body.opportunity_ids.length
  return listings > 0 && listings <= 10
})

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

function databaseError(error: unknown) {
  const code = error instanceof BroadcastDatabaseError ? error.code : undefined
  if (code === 'P0429') return json({ error: 'Too many broadcast submissions. Try again shortly.' }, 429, { 'Retry-After': '60' })
  if (code === 'P0409') return json({ error: 'This broadcast ID is already used or belongs to a historical broadcast.' }, 409)
  if (code === 'P0400') return json({ error: 'The selection has no verified listings or the audience is outside supported limits.' }, 400)
  if (code === '42501') return json({ error: 'Admin access required.' }, 403)
  return json({ error: 'Broadcast data is temporarily unavailable. Retry using the same broadcast ID.' }, 503)
}

function adminDatabase(budget: BroadcastBudget) {
  return broadcastDatabase({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }, budget)
}

export async function GET(request: Request) {
  const budget = new BroadcastBudget(12)
  try {
    const guard = await assertAdmin(await createClient(budget.fetch))
    if (!guard.ok) return guard.response
    const rpc = adminDatabase(budget)
    const raw = new URL(request.url).searchParams.get('id')
    if (raw === null) return json(await rpc<BroadcastOverview>('broadcast_overview', { p_admin: guard.userId }))
    const id = uuid.safeParse(raw)
    if (!id.success) return json({ error: 'Invalid broadcast ID.' }, 400)
    const status = await rpc<BroadcastStatus | null>('broadcast_status', { p_admin: guard.userId, p_id: id.data })
    return status ? json(status) : json({ error: 'Broadcast not found.' }, 404)
  } catch (error) {
    return databaseError(error)
  }
}

export async function POST(request: Request) {
  const budget = new BroadcastBudget(12)
  try {
    const guard = await assertAdmin(await createClient(budget.fetch))
    if (!guard.ok) return guard.response
    const parsed = bodySchema.safeParse(await readBoundedJson(request, 8192).catch(() => null))
    if (!parsed.success) return json({ error: 'Provide a broadcast ID and select one to ten listings.' }, 400)
    const { broadcast_id, scholarship_ids, opportunity_ids, batch } = parsed.data
    const rpc = adminDatabase(budget)
    const status = await rpc<BroadcastStatus>('broadcast_enqueue', {
      p_admin: guard.userId,
      p_id: broadcast_id,
      p_scholarships: scholarship_ids,
      p_opportunities: opportunity_ids,
      p_batch: batch ?? null,
      p_base_url: process.env.NEXT_PUBLIC_APP_URL || 'https://www.scholars.com.ng',
    })
    const location = '/api/admin/broadcast?id=' + status.id
    return json({ ...status, status_url: location }, 202, { Location: location })
  } catch (error) {
    return databaseError(error)
  }
}
