// app/api/auth/password-check/route.ts
// POST /api/auth/password-check { password } -> { leaked, count, checked }
//
// AUTH SECURITY AUDIT (password leak check): proxies the HaveIBeenPwned
// k-anonymity API. Only the first 5 hex chars of the SHA-1 hash leave this
// server; HIBP never sees the password or the full hash. The response is a
// boolean plus count, so the client learns nothing reusable.
//
// Rate limited per client IP (10/min). Vercel serverless instances are
// ephemeral, so this map is a speed-bump per instance, not a global
// guarantee -- acceptable here because the endpoint reveals only a boolean
// and HIBP itself rate-limits ranges.
//
// Fail-open by design: if HIBP is unreachable we return checked:false and
// let signup proceed. The strength rules (lib/auth/password.ts) and
// Supabase's own policy still apply, and blocking account creation because
// a third-party API is down would be a worse failure mode.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createHash } from 'crypto'

const bodySchema = z.object({ password: z.string().min(1).max(128) })

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 10
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (arr.length >= MAX_PER_WINDOW) {
    hits.set(ip, arr)
    return true
  }
  arr.push(now)
  hits.set(ip, arr)
  return false
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const hash = createHash('sha1').update(parsed.data.password).digest('hex').toUpperCase()
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)

  try {
    const resp = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'Scholars-auth-audit' },
    })
    if (!resp.ok) {
      return NextResponse.json({ leaked: false, count: 0, checked: false })
    }
    const text = await resp.text()
    const line = text.split('\n').find((l) => l.split(':')[0] === suffix)
    const count = line ? parseInt(line.split(':')[1], 10) || 0 : 0
    return NextResponse.json({ leaked: count > 0, count, checked: true })
  } catch {
    return NextResponse.json({ leaked: false, count: 0, checked: false })
  }
}
