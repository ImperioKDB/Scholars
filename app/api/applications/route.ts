// Shared application tracker for scholarships and opportunities.
import { dbErrorResponse } from '@/lib/errors'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { authFailureResponse } from '@/lib/auth/request-errors'
import { checkRateLimit } from '@/lib/ratelimit'
import { trackServerEvent } from '@/lib/analytics-server'

const createSchema = z.object({
  scholarship_id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid().optional(),
}).refine((body) => Boolean(body.scholarship_id) !== Boolean(body.opportunity_id), 'Provide exactly one listing id')

const SCHOLARSHIP_COLUMNS = 'id, title, provider_name, description, amount, deadline, application_url, how_to_apply, level, discipline, verified'
const OPPORTUNITY_COLUMNS = 'id, type, title, provider_name, description, eligibility_notes, duration, location, compensation, discipline, deadline, application_url, how_to_apply, verified'
const APPLICATION_COLUMNS = `id, status, notes, created_at, updated_at, link_clicked_at, checkin_prompted_at, draft_statement, draft_summary, draft_generated_at, draft_confirmed_at, scholarship:scholarships ( ${SCHOLARSHIP_COLUMNS} ), opportunity:opportunities ( ${OPPORTUNITY_COLUMNS} )`

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return authFailureResponse(authError)
  const { data, error } = await supabase.from('applications').select(APPLICATION_COLUMNS).eq('profile_id', user.id).order('updated_at', { ascending: false })
  if (error) return dbErrorResponse('applications', error)
  return NextResponse.json({ applications: data })
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: 'applications', limit: 20 })
  if (limited) return limited
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return authFailureResponse(authError)
  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 })
  const listing = parsed.data.scholarship_id ? { scholarship_id: parsed.data.scholarship_id } : { opportunity_id: parsed.data.opportunity_id }
  const { data, error } = await supabase.from('applications').insert({ profile_id: user.id, ...listing }).select(APPLICATION_COLUMNS).single()
  if (error) {
    if (error.code === '23505') {
      const column = parsed.data.scholarship_id ? 'scholarship_id' : 'opportunity_id'
      const { data: existing } = await supabase.from('applications').select(APPLICATION_COLUMNS).eq('profile_id', user.id).eq(column, parsed.data.scholarship_id ?? parsed.data.opportunity_id).single()
      return NextResponse.json({ application: existing, message: 'Already tracking' }, { status: 200 })
    }
    if (error.code === '23503') return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    return dbErrorResponse('applications', error)
  }
  trackServerEvent(supabase, user.id, 'application_started', parsed.data.scholarship_id ? { scholarship_id: parsed.data.scholarship_id } : { opportunity_id: parsed.data.opportunity_id! })
  return NextResponse.json({ application: data }, { status: 201 })
}
