// app/api/scholarships/save/route.ts
// GET    /api/scholarships/save            — list the current user's saved scholarships
// POST   /api/scholarships/save            — save a scholarship { scholarship_id }
// DELETE /api/scholarships/save?scholarship_id=... — unsave a scholarship
//
// SCOPE NOTE: 05_CODING_WORKFLOW.md only specs POST/DELETE here. GET is added
// because the MVP dashboard (01_PRD.md #6) needs a "saved scholarships" list,
// and there's nowhere else in the planned API surface to get it from. Flagging
// as a deliberate addition, not silent scope creep — remove if you'd rather
// fold this into the dashboard route later.
//
// scholarship:scholarships!inner on GET -- a saved scholarship that has
// since been unverified by an admin fails the scholarships_select_verified
// RLS policy on the join. Without !inner, PostgREST returns the
// saved_scholarships row with scholarship: null instead of dropping it,
// and any consumer reading scholarship.* unconditionally crashes. Same
// fix as app/dashboard/page.tsx, app/applications/page.tsx,
// app/api/applications/route.ts, and app/api/applications/[id]/route.ts.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const saveSchema = z.object({
  scholarship_id: z.string().uuid(),
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

  const { data, error } = await supabase
    .from('saved_scholarships')
    .select(
      `id, saved_at,
       scholarship:scholarships!inner ( id, title, provider_name, description, amount, deadline, application_url, level, discipline, verified )`
    )
    .eq('profile_id', user.id)
    .order('saved_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ saved: data })
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
  const parsed = saveSchema.safeParse(raw)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('saved_scholarships')
    .insert({ profile_id: user.id, scholarship_id: parsed.data.scholarship_id })
    .select('*')
    .single()

  if (error) {
    // 23505 = unique_violation — already saved. Not really an error from the
    // client's point of view, so return success rather than a 500/409 fight.
    if (error.code === '23505') {
      return NextResponse.json({ message: 'Already saved' }, { status: 200 })
    }
    // 23503 = foreign_key_violation — scholarship_id doesn't exist
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Scholarship not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ saved: data }, { status: 201 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = saveSchema.safeParse({
    scholarship_id: searchParams.get('scholarship_id'),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid or missing scholarship_id query param', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('saved_scholarships')
    .delete()
    .eq('profile_id', user.id)
    .eq('scholarship_id', parsed.data.scholarship_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Unsaved' })
}
