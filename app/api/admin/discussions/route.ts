import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/admin/guard";
import { checkRateLimit } from "@/lib/ratelimit";
import { dbErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: "admin-discussions", limit: 60 });
  if (limited) return limited;
  const supabase = createClient();
  const guard = await assertAdmin(supabase);
  if (!guard.ok) return guard.response;

  const status = new URL(request.url).searchParams.get("status");
  let query = supabase
    .from("scholarship_discussions")
    .select("id, scholarship_id, parent_id, category, title, body, is_anonymous, status, is_pinned, is_verified_contributor, helpful_count, created_at, updated_at, scholarship:scholarships(title, slug)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status === "hidden" || status === "published") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return dbErrorResponse("admin/discussions", error);
  return NextResponse.json({ discussions: data ?? [] });
}
