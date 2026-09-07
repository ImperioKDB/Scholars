import { NextResponse } from "next/server";
import type { createClient } from "@/lib/supabase/server";

// lib/admin/guard.ts
//
// Single server-side admin assertion for API routes. Replaces the four
// copy-pasted requireAdmin() blocks that lived inside the admin API route
// files (app/api/admin/scholarships/**). Same semantics, same 401/403 JSON
// bodies as before -- this is a dedup, not a behavior change.
//
// Distinct from lib/admin/access.ts on purpose: access.ts is the
// redirect-based gate for Server Components (layouts/pages), where a
// redirect is the right control flow. API routes need a returnable
// NextResponse instead, so they use this guard and return guard.response.
//
// This is a UX/authorization convenience, not the security boundary -- the
// real enforcement is the is_admin(auth.uid()) RLS policy on scholarships /
// scholarship_rules, plus the middleware /api/admin gate, so a bug here
// cannot expose write access.
type Supabase = ReturnType<typeof createClient>;

export type AdminGuard =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function assertAdmin(supabase: Supabase): Promise<AdminGuard> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (profileError || !profile?.is_admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }
  return { ok: true, userId: user.id };
}
