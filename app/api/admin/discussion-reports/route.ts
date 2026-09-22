import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/admin/guard";
import { checkRateLimit } from "@/lib/ratelimit";
import { dbErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { route: "admin-discussion-reports", limit: 60 });
  if (limited) return limited;
  const supabase = createClient();
  const guard = await assertAdmin(supabase);
  if (!guard.ok) return guard.response;
  const status = new URL(request.url).searchParams.get("status");
  let query = supabase
    .from("scholarship_discussion_reports")
    .select("id, discussion_id, reporter_id, reason, details, status, reviewed_by, reviewed_at, created_at, discussion:scholarship_discussions(title, body, scholarship_id)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status === "open" || status === "reviewed" || status === "dismissed" || status === "removed") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return dbErrorResponse("admin/discussion-reports", error);
  return NextResponse.json({ reports: data ?? [] });
}
