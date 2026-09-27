import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/admin/guard";
import { checkRateLimit } from "@/lib/ratelimit";
import { dbErrorResponse } from "@/lib/errors";
import { isUuid } from "@/lib/validate";

const updateSchema = z.object({ status: z.enum(["reviewed", "dismissed", "removed"]) });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const limited = await checkRateLimit(request, { route: "admin-discussion-report-update", limit: 60 });
  if (limited) return limited;
  if (!isUuid(params.id)) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const supabase = createClient();
  const guard = await assertAdmin(supabase);
  if (!guard.ok) return guard.response;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid report update" }, { status: 400 });
  const { data: report, error: reportError } = await supabase
    .from("scholarship_discussion_reports")
    .update({ status: parsed.data.status, reviewed_by: guard.userId, reviewed_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("id, discussion_id, status, reviewed_at")
    .maybeSingle();
  if (reportError) return dbErrorResponse("admin/discussion-reports/update", reportError);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (parsed.data.status === "removed") {
    const { error: hideError } = await supabase
      .from("scholarship_discussions")
      .update({ status: "hidden" })
      .eq("id", report.discussion_id);
    if (hideError) return dbErrorResponse("admin/discussion-reports/hide", hideError);
  }
  return NextResponse.json({ report });
}
