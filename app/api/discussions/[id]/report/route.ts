import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { dbErrorResponse } from "@/lib/errors";
import { isUuid } from "@/lib/validate";

const reportSchema = z.object({
  reason: z.enum(["misleading", "abusive", "outdated", "personal_information", "spam"]),
  details: z.string().trim().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return NextResponse.json({ error: "Invalid discussion id" }, { status: 400 });
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const limited = await checkRateLimit(request, { route: "scholarship-discussion-report", limit: 10, extraKeys: [`user:${user.id}`] });
  if (limited) return limited;
  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please choose a report reason" }, { status: 400 });
  const { data, error } = await supabase
    .from("scholarship_discussion_reports")
    .insert({ discussion_id: params.id, reporter_id: user.id, ...parsed.data })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ message: "Already reported" });
    return dbErrorResponse("scholarship_discussion_report", error);
  }
  return NextResponse.json({ report: data }, { status: 201 });
}
