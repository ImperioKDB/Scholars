// app/api/admin/opportunities/route.ts
// GET  /api/admin/opportunities -- list opportunities (verified + unverified), admin only.
// POST /api/admin/opportunities -- create an opportunity, admin only.
//
// Mirrors /api/admin/scholarships. No `rules` sub-resource -- opportunities
// are discovery-only in v1, eligibility_notes is free text shown as-is,
// never scored or gated. Defense in depth: RLS already restricts writes to
// is_admin(auth.uid()), but profile.is_admin is also checked server-side so
// a non-admin gets a clean 403 instead of a Postgres RLS error.
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'

// PERF (batch 1): reliability cap, same rationale as the scholarships
// admin list and the health page's ROW_CAP.
const ADMIN_LIST_CAP = 1000;

const opportunitySchema = z.object({
  type: z.enum(['fellowship', 'internship', 'competition', 'mentorship']),
  title: z.string().trim().min(1).max(300),
  provider_name: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).nullable().optional(),
  eligibility_notes: z.string().trim().max(2000).nullable().optional(),
  duration: z.string().trim().max(200).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  compensation: z.string().trim().max(200).nullable().optional(),
  discipline: z.string().trim().max(200).nullable().optional(),
  deadline: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date'),
  opens_at: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date'),
  application_url: z.string().url().nullable().optional(),
  how_to_apply: z.string().trim().max(2000).nullable().optional(),
  verified: z.boolean().default(false),
  research_notes: z.string().trim().max(2000).nullable().optional(),
})

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

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-opportunities', limit: 60 })
  if (limited) return limited
  const supabase = await createClient()
  const check = await requireAdmin(supabase)
  if (check.error) return check.error
  const { data: opportunities, error } = await supabase
    .from('opportunities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(ADMIN_LIST_CAP)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ opportunities })
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-opportunities', limit: 60 })
  if (limited) return limited
  const supabase = await createClient()
  const check = await requireAdmin(supabase)
  if (check.error) return check.error
  const raw = await request.json().catch(() => null)
  const parsed = opportunitySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid opportunity data', issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const { data: opportunity, error: insertError } = await supabase
    .from('opportunities')
    .insert({ ...parsed.data, created_by: check.user!.id })
    .select('*')
    .single()
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }
  // SHARE PAGES: /o/[id] is ISR (revalidate 300) -- drop its cached render
  // so a new opportunity's share page is live immediately.
  revalidatePath('/o/[id]')
  return NextResponse.json({ opportunity }, { status: 201 })
}
