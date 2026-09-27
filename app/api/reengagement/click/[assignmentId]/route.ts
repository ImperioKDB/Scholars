import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://scholars-eight.vercel.app'
const ALLOWED_PATHS = new Set(['/onboarding', '/applications', '/dashboard'])

export async function GET(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params
  const limited = await checkRateLimit(request, { route: 'reengagement-click', limit: 60 })
  if (limited) return limited
  const service = createServiceClient()
  const { data: assignment, error } = await service
    .from('reengagement_assignments')
    .select('id,experiment_id,deep_link')
    .eq('id', assignmentId)
    .maybeSingle()

  if (error || !assignment || !ALLOWED_PATHS.has(assignment.deep_link)) {
    return NextResponse.redirect(new URL('/dashboard', BASE_URL), 302)
  }

  await service.from('reengagement_campaign_events').insert({
    experiment_id: assignment.experiment_id,
    assignment_id: assignment.id,
    event: 'clicked',
    meta: { user_agent: request.headers.get('user-agent')?.slice(0, 200) ?? null },
  })

  const destination = new URL(assignment.deep_link, BASE_URL)
  destination.searchParams.set('reengagement', '1')
  destination.searchParams.set('assignment', assignment.id)
  return NextResponse.redirect(destination, 302)
}
