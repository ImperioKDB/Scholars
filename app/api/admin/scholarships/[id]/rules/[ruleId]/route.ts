// app/api/admin/scholarships/[id]/rules/[ruleId]/route.ts
// DELETE /api/admin/scholarships/[id]/rules/[ruleId] — remove a single
// eligibility rule from a scholarship, admin only.
//
// scholarshipId is included in the path (not just ruleId) purely for
// clean/RESTful URLs — the delete itself matches on rule id, scoped by
// scholarship_id as a belt-and-suspenders check so a rule can't be
// deleted via the wrong scholarship's URL by mistake.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (profileError || !profile?.is_admin) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }
  return { user }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  // SECURITY HARDENING (phase 1): see the 60/min note on the list route.
  // Request param renamed from _request to request so the limiter can
  // read x-forwarded-for; the rest of the handler is unchanged.
  const limited = await checkRateLimit(request, { route: 'admin-rules-id', limit: 60 })
  if (limited) return limited

  const { id: scholarshipId, ruleId } = await params
  const supabase = await createClient()
  const check = await requireAdmin(supabase)
  if (check.error) return check.error
  const { error, count } = await supabase
    .from('scholarship_rules')
    .delete({ count: 'exact' })
    .eq('id', ruleId)
    .eq('scholarship_id', scholarshipId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!count) {
    return NextResponse.json({ error: 'Rule not found on this scholarship' }, { status: 404 })
  }
  return NextResponse.json({ message: 'Rule deleted' })
}
