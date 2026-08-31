// app/api/applications/[id]/click/route.ts
// POST /api/applications/[id]/click
//
// Fired the moment a student clicks "Apply on provider's site" for a
// tracked application. Records when they left for the external portal --
// this is the trigger Ade (the mascot) uses to ask a follow-up question
// next time they're back in the app. It does NOT mean they applied; it
// only means they opened the link, which is why the follow-up question is
// always phrased as a genuine ask, never an assumption.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    .update({ link_clicked_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', id)
    .eq('profile_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!count) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  return NextResponse.json({ message: 'Recorded' })
}
