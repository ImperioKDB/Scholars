// app/api/applications/route.ts
// GET  /api/applications  — list the current user's tracked applications
// POST /api/applications  — start tracking a scholarship { scholarship_id }
//
// Lightweight by design: status only (in_progress/submitted/accepted/
// rejected) plus optional notes, no documents/checklist/interview stages.
// Separate from saved_scholarships -- saving means "might apply", creating
// an application here means "actually pursuing this."

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const createSchema = z.object({
  scholarship_id: z.string().uuid(),
})

const SCHOLARSHIP_COLUMNS =
  'id, title, provider_name, description, amount, deadline, application_url, level, discipline, verified'

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
    .from('applications')
    .select(`id, status, notes, created_at, updated_at, scholarship:scholarships ( ${SCHOLARSHIP_COLUMNS} )`)
    .eq('profile_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ applications: data })
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
  const parsed = createSchema.safeParse(raw)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('applications')
    .insert({ profile_id: user.id, scholarship_id: parsed.data.scholarship_id })
    .select(`id, status, notes, created_at, updated_at, scholarship:scholarships ( ${SCHOLARSHIP_COLUMNS} )`)
    .single()

  if (error) {
    // 23505 = unique_violation — already tracking this scholarship. Return
    // the existing row instead of erroring, same pattern as /save.
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('applications')
        .select(`id, status, notes, created_at, updated_at, scholarship:scholarships ( ${SCHOLARSHIP_COLUMNS} )`)
        .eq('profile_id', user.id)
        .eq('scholarship_id', parsed.data.scholarship_id)
        .single()
      return NextResponse.json({ application: existing, message: 'Already tracking' }, { status: 200 })
    }
    // 23503 = foreign_key_violation — scholarship_id doesn't exist
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Scholarship not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ application: data }, { status: 201 })
}
