// app/api/opportunities/save/route.ts
// GET    /api/opportunities/save              -- list the current user's saved opportunities
// POST   /api/opportunities/save              -- save an opportunity { opportunity_id }
// DELETE /api/opportunities/save?opportunity_id=... -- unsave an opportunity
//
// Mirrors /api/scholarships/save exactly. opportunity:opportunities!inner
// on GET -- a saved opportunity that has since been unverified by an admin
// fails the opportunities_select_verified RLS policy on the join; !inner
// drops that row instead of returning { opportunity: null }, same fix
// already applied throughout the scholarships side of this codebase.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'

const saveSchema = z.object({
  opportunity_id: z.string().uuid(),
})

const OPPORTUNITY_COLUMNS =
  'id, type, title, provider_name, description, duration, location, compensation, discipline, deadline, opens_at, application_url, how_to_apply, verified'

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
    .from('saved_opportunities')
    .select(`id, saved_at, opportunity:opportunities!inner ( ${OPPORTUNITY_COLUMNS} )`)
    .eq('profile_id', user.id)
    .order('saved_at', { ascending: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ saved: data })
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: 'save-opportunity', limit: 20 })
  if (limited) return limited

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
    .from('saved_opportunities')
    .insert({ profile_id: user.id, opportunity_id: parsed.data.opportunity_id })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ message: 'Already saved' }, { status: 200 })
    }
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ saved: data }, { status: 201 })
}

export async function DELETE(request: Request) {
  const limited = await checkRateLimit(request, { route: 'save-opportunity', limit: 20 })
  if (limited) return limited

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
    opportunity_id: searchParams.get('opportunity_id'),
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid or missing opportunity_id query param', issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const { error } = await supabase
    .from('saved_opportunities')
    .delete()
    .eq('profile_id', user.id)
    .eq('opportunity_id', parsed.data.opportunity_id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ message: 'Unsaved' })
}
