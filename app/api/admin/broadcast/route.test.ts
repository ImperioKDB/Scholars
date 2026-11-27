import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

const auth = vi.hoisted(() => ({ allow: true, calls: 0 }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async (fetcher: typeof fetch) => fetcher,
}))
vi.mock('@/lib/admin/guard', () => ({
  assertAdmin: async (fetcher: typeof fetch) => {
    for (let i = 0; i < auth.calls; i++) await fetcher('https://database.example.invalid/auth/v1/user')
    return auth.allow
      ? { ok: true, userId: 'a0000000-0000-4000-8000-000000000001' }
      : { ok: false, response: new Response(null, { status: 403 }) }
  },
}))

const campaign = '00000000-0000-4000-8000-000000000001'
const listing = '00000000-0000-4000-8000-000000000002'
const url = 'https://app.example.invalid/api/admin/broadcast'
const status = { id: campaign, email: { queued: 300 }, push_profiles: { queued: 78 } }

function post(data: unknown) {
  return POST(new Request(url, { method: 'POST', body: JSON.stringify(data) }))
}

describe('broadcast admin API', () => {
  beforeEach(() => {
    auth.allow = true
    auth.calls = 0
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://database.example.invalid')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('enqueues only a persisted snapshot and returns its reload URL', async () => {
    auth.calls = 3
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(status))
    vi.stubGlobal('fetch', fetcher)
    const response = await post({ broadcast_id: campaign, scholarship_ids: [listing], batch: 'A' })
    expect(response.status).toBe(202)
    expect(response.headers.get('Location')).toBe('/api/admin/broadcast?id=' + campaign)
    expect(await response.json()).toEqual({ ...status, status_url: '/api/admin/broadcast?id=' + campaign })
    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(String(fetcher.mock.calls.at(-1)?.[0])).toMatch(/\/rpc\/broadcast_enqueue$/)
    for (const [, init] of fetcher.mock.calls) expect(init?.redirect).toBe('manual')
  })

  it('reads durable status without scheduling work', async () => {
    auth.calls = 2
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(status))
    vi.stubGlobal('fetch', fetcher)
    const response = await GET(new Request(url + '?id=' + campaign))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual(status)
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(String(fetcher.mock.calls.at(-1)?.[0])).toMatch(/\/rpc\/broadcast_status$/)
  })

  it('requires the admin guard and a stable submission ID', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    auth.allow = false
    expect((await post({ broadcast_id: campaign, scholarship_ids: [listing] })).status).toBe(403)
    auth.allow = true
    expect((await post({ scholarship_ids: [listing] })).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('caps authentication retries before making any mutation', async () => {
    auth.calls = 60
    const fetcher = vi.fn(async () => Response.json({}))
    vi.stubGlobal('fetch', fetcher)
    expect((await post({ broadcast_id: campaign, scholarship_ids: [listing] })).status).toBe(503)
    expect(fetcher).toHaveBeenCalledTimes(12)
  })

  it('reports an incident submission as a conflict', async () => {
    const fetcher = vi.fn(async () => Response.json({ code: 'P0409' }, { status: 400 }))
    vi.stubGlobal('fetch', fetcher)
    expect((await post({ broadcast_id: campaign, scholarship_ids: [listing] })).status).toBe(409)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
