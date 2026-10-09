import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/admin/guard";

const REPORTS = new Set(["growth", "funnel", "retention", "provider"]);

function parseDate(value: string | null, fallback: Date): Date | null {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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
  const admin = await assertAdmin(supabase);
  if (!admin.ok) return admin.response;

  const url = new URL(request.url);
  const now = new Date();
  const sinceDate = parseDate(url.searchParams.get("since"), new Date(now.getTime() - 30 * 86400000));
  const untilDate = parseDate(url.searchParams.get("until"), now);
  const report = url.searchParams.get("report");

  if (!sinceDate || !untilDate || sinceDate >= untilDate) {
    return NextResponse.json({ error: "Invalid analytics date range" }, { status: 400 });
  }
  if (report && !REPORTS.has(report)) {
    return NextResponse.json({ error: "Unknown analytics report" }, { status: 400 });
  }

  const scholarshipParam = url.searchParams.get("scholarship_id");
  if (scholarshipParam && !isUuid(scholarshipParam)) {
    return NextResponse.json({ error: "Invalid scholarship id" }, { status: 400 });
  }

  const since = sinceDate.toISOString();
  const until = untilDate.toISOString();
  const scholarshipId = scholarshipParam || null;

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
