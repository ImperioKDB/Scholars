// app/api/admin/scholarships/[id]/rules/[ruleId]/route.ts
// DELETE /api/admin/scholarships/[id]/rules/[ruleId] — remove a single
// eligibility rule from a scholarship, admin only.
//
// scholarshipId is in the path (not just ruleId) purely for clean URLs;
// the delete matches on rule id scoped by scholarship_id as a
// belt-and-suspenders check so a rule can't be deleted via the wrong
// scholarship's URL by mistake.
//
// INPUT HARDENING: both path params are UUID-validated up front.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { assertAdmin } from '@/lib/admin/guard'
import { isUuid } from '@/lib/validate'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  const limited = await checkRateLimit(request, { route: 'admin-rules-id', limit: 60 })
  if (limited) return limited

  const { id: scholarshipId, ruleId } = await params
  if (!isUuid(scholarshipId)) {
    return NextResponse.json({ error: 'Scholarship not found' }, { status: 404 })
  }
  if (!isUuid(ruleId)) {
    return NextResponse.json({ error: 'Rule not found on this scholarship' }, { status: 404 })
  }

  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response

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
