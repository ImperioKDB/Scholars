// app/api/profile/route.ts
// GET  /api/profile  — fetch the current user's profile (404 if not created yet)
// POST /api/profile  — create or update the current user's profile (upsert)
//
// profile_completeness is NOT accepted from the client — it's trigger-computed
// in Postgres (see set_profile_completeness()) so it can't be spoofed by a
// client sending a high number to game the matching score.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const profileSchema = z.object({
  full_name: z.string().trim().min(1).max(200).nullable().optional(),
  academic_level: z.enum(['undergrad', 'postgrad']).nullable().optional(),
  discipline: z.string().trim().min(1).max(200).nullable().optional(),
  gpa: z.number().min(0).max(4.0).nullable().optional(),
  nationality: z.string().trim().min(1).max(100).nullable().optional(),
  gender: z.string().trim().min(1).max(50).nullable().optional(),
  financial_need: z.boolean().optional(),
  career_goals: z.string().trim().max(2000).nullable().optional(),
})

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    // PGRST116 = no rows found — a normal "not created yet" state, not a server error
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile })
}

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
  const parsed = profileSchema.safeParse(raw)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid profile data', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, ...parsed.data }, { onConflict: 'id' })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile })
}
