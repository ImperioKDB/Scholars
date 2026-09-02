// app/api/achievements/announce/route.ts
// POST { achievement_id }
//
// Marks one of the current user's already-unlocked achievements as
// announced, so Ade (see app/api/mascot/next-prompt/route.ts,
// components/ade/AdeProvider.tsx) doesn't surface it again. Scoped by the
// user_achievements_update_own_announced RLS policy to the caller's own
// rows -- this route cannot unlock a NEW achievement or touch anyone
// else's, it can only flip announced_at on a row that already exists for
// auth.uid().

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({ achievement_id: z.string().min(1) })

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_achievements')
    .update({ announced_at: new Date().toISOString() })
    .eq('profile_id', user.id)
    .eq('achievement_id', parsed.data.achievement_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Announced' })
}
