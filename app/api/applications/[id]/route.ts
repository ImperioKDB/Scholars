// app/api/applications/[id]/route.ts
// PATCH  /api/applications/[id] — update status and/or notes
// DELETE /api/applications/[id] — stop tracking
//
// Scoped by .eq('profile_id', user.id) in addition to RLS, same
// belt-and-suspenders pattern as the admin rules routes -- makes a
// cross-user id guess a clean 404 instead of relying solely on RLS.
//
// SCHOLARSHIP_COLUMNS also includes how_to_apply now, for consistency with
// GET /api/applications -- see migration: add_how_to_apply_fallback.
//
// scholarship:scholarships!inner on the PATCH select -- same reasoning as
// app/api/applications/route.ts and app/applications/page.tsx: an
// application whose scholarship has since failed RLS (e.g. unverified by
// an admin) must not come back as { scholarship: null } for a client that
// reads application.scholarship.* unconditionally.
//
// NOTE: with !inner, if the scholarship attached to this application has
// been unverified since it was last fetched, this PATCH's .single() can
// return no rows, which the branch below reports as 'Application not
// found' (404). That's a slightly misleading message in that rare case --
// not fixed here, flagged as a known edge case.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const STATUS_VALUES = ['in_progress', 'submitted', 'accepted', 'rejected'] as const

const updateSchema = z
  .object({
    status: z.enum(STATUS_VALUES),
    notes: z.string().max(2000).nullable(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, 'No fields to update')

const SCHOLARSHIP_COLUMNS =
  'id, title, provider_name, description, amount, deadline, application_url, how_to_apply, level, discipline, verified'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(raw)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid update data', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('applications')
    .update(parsed.data)
    .eq('id', id)
    .eq('profile_id', user.id)
    .select(`id, status, notes, created_at, updated_at, scholarship:scholarships!inner ( ${SCHOLARSHIP_COLUMNS} )`)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ application: data })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { error, count } = await supabase
    .from('applications')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('profile_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!count) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  return NextResponse.json({ message: 'Stopped tracking' })
}
