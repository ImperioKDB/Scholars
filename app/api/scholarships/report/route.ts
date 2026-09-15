import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/errors";
import { trackServerEvent } from "@/lib/analytics-server";

const reportSchema = z.object({
  scholarship_id: z.string().uuid(),
  reason: z.enum(["deadline_wrong", "broken_link", "closed", "not_eligible", "unclear", "other"]),
  details: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid report" }, { status: 400 });

  const { data, error } = await supabase
    .from("scholarship_reports")
    .insert({ profile_id: user.id, ...parsed.data })
    .select("id")
    .single();
  if (error) return dbErrorResponse("scholarship_reports", error);

  trackServerEvent(supabase, user.id, "scholarship_issue_reported", {
    scholarship_id: parsed.data.scholarship_id,
    reason: parsed.data.reason,
  });
  return NextResponse.json({ report: data }, { status: 201 });
}
