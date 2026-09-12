// app/api/admin/active-users/route.ts
// GET /api/admin/active-users -- list student profiles for the admin
// Active Users table. Admin-only: middleware /api/admin gate plus
// assertAdmin() here, the same defense in depth as the other admin routes.
//
// Rate limited 30/min so a stuck refresh button can't hammer the DB.
// Capped at ACTIVE_USERS_CAP rows, most-recently-updated first, so the
// response stays scannable on a phone and the function stays well inside
// its time budget even as the student base grows.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { assertAdmin } from '@/lib/admin/guard'

const ACTIVE_USERS_CAP = 200

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-active-users', limit: 30 })
  if (limited) return limited

  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, discipline, institution_name, profile_completeness, xp_total, created_at, updated_at'
    )
    .order('updated_at', { ascending: false })
    .limit(ACTIVE_USERS_CAP)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Emails live in auth.users, not profiles. A single service-role
  // listUsers() call (paginated) is cheaper and more authoritative than
  // denormalizing email onto profiles, and the admin table is the only
  // consumer that needs the join.
  const emailById = new Map<string, string>()
  try {
    for (let page = 1; page <= 100; page++) {
      const { data, error: usersError } = await supabase.auth.admin.listUsers({
        page,
        perPage: 100,
      })
      if (usersError) break
      const users = data?.users ?? []
      for (const u of users) {
        if (u.id && u.email) emailById.set(u.id, u.email)
      }
      if (users.length < 100) break
    }
  } catch {
    // Email enrichment is best-effort: the table still renders with
    // profile data alone if auth.admin is unreachable.
  }

  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailById.get(p.id) ?? null,
    discipline: p.discipline,
    institution_name: p.institution_name,
    profile_completeness: p.profile_completeness,
    xp_total: p.xp_total,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }))

  return NextResponse.json({ users })
}
