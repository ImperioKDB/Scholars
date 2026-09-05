// app/api/auth/password-check/route.ts
// POST /api/auth/password-check { password } -> { leaked, count, checked }
//
// AUTH SECURITY AUDIT (password leak check): proxies the HaveIBeenPwned
// k-anonymity API. Only the first 5 hex chars of the SHA-1 hash leave this
// server; HIBP never sees the password or the full hash. The response is a
// boolean plus count, so the client learns nothing reusable.
//
// SECURITY HARDENING (phase 1): the old in-memory Map limiter is gone --
// it reset on every cold start and was never shared across instances.
// Rate limiting now goes through the shared Upstash Redis helper
// (lib/ratelimit.ts), 10/min per IP: stricter than the generic 20/min
// because this endpoint makes an outbound third-party call per request.
//
// Fail-open by design: if HIBP is unreachable we return checked:false and
// let signup proceed. The strength rules (lib/auth/password.ts) and
// Supabase's own policy still apply, and blocking account creation because
// a third-party API is down would be a worse failure mode.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createHash } from 'crypto'
import { checkRateLimit } from '@/lib/ratelimit'

const bodySchema = z.object({ password: z.string().min(1).max(128) })

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: 'password-check', limit: 10 })
  if (limited) return limited

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
