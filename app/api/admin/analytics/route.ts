import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
function csv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  return [columns.map(csvCell).join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n");
}

export async function GET(request: Request) {
  const supabase = createClient();
  const url = new URL(request.url);
  const now = new Date();
  const since = url.searchParams.get("since") || new Date(now.getTime() - 30 * 86400000).toISOString();
  const until = url.searchParams.get("until") || now.toISOString();
  const scholarshipId = url.searchParams.get("scholarship_id") || null;
  const report = url.searchParams.get("report");

  const { data, error } = await supabase.rpc("get_provider_analytics", {
    p_since: since,
    p_until: until,
    p_scholarship_id: scholarshipId,
  });
  if (error) return NextResponse.json({ error: "Analytics unavailable" }, { status: 500 });

  if (report) {
    const payload = data ?? {};
    let rows: Record<string, unknown>[] = [];
    if (report === "growth") rows = payload.growth?.daily_signups ?? [];
    if (report === "funnel") rows = payload.scholarship_funnel ?? [];
    if (report === "retention") rows = [payload.retention ?? {}];
    if (report === "provider") rows = payload.scholarship_funnel ?? [];
    if (!rows.length) rows = [{ message: "No aggregate data in this period" }];
    return new NextResponse(csv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="scholars-${report}-report.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
