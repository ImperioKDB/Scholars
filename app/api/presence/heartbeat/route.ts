// app/api/presence/heartbeat/route.ts
// POST /api/presence/heartbeat -- presence heartbeat (Push E).
//
// Authed, rate-limited (10/min per IP), RLS-scoped update of the caller's
// own profiles.last_seen_at. No service role needed: profiles_update_own
// already scopes the update to auth.uid() = id. Returns 401 when signed
// out so the client hook can stay silent rather than retrying.
import { dbErrorResponse } from '@/lib/errors'
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: "presence-heartbeat", limit: 10 });
  if (limited) return limited;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { error } = await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) {
    return dbErrorResponse('presence/heartbeat', error);
  }
  return NextResponse.json({ ok: true });
}
