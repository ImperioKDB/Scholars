// app/api/csp-report/route.ts
// POST-only collector for Content-Security-Policy violation reports (see
// the report-uri directive in next.config.js, enforcing since
// CSP_AUDIT.md 2026-09-13). Browsers POST a JSON body here whenever the
// policy blocks something. We log a compact one-line summary through
// lib/logging.ts so it is searchable in Vercel Logs, then return 204
// immediately.
//
// This is what makes "is the console clean" answerable from a phone: no
// devtools needed, just Vercel dashboard -> Logs -> search "csp".
//
// Deliberately:
//   - No auth: reports are posted by browsers with no app session. The
//     body is attacker-controllable in principle, so it is only ever
//     logged as an opaque string, never parsed into logic.
//   - Body capped at 4KB before logging, so a hostile page cannot use
//     this as an unbounded log-flood sink.
//   - Accepts every report shape: the legacy {"csp-report": {...}}
//     (report-uri), the newer Reporting API array format
//     ([{ type, body: {...} }]) unwrapping .body when present so logged
//     detail stays field-level instead of the outer envelope, and bare
//     objects from any future sender.
import { logWarn } from "@/lib/logging";

const MAX_BODY = 4096;

type ReportRecord = Record<string, unknown>;

function unwrapReport(parsed: unknown): ReportRecord {
  if (Array.isArray(parsed)) {
    const first = parsed[0];
    if (first && typeof first === "object") {
      // Reporting API envelope: { type: "csp-violation", body: {...} }
      const body = (first as { body?: unknown }).body;
      if (body && typeof body === "object") return body as ReportRecord;
      return first as ReportRecord;
    }
    return {};
  }
  if (parsed && typeof parsed === "object") {
    const legacy = (parsed as { "csp-report"?: unknown })["csp-report"];
    if (legacy && typeof legacy === "object") return legacy as ReportRecord;
    return parsed as ReportRecord;
  }
  return {};
}

export async function POST(request: Request) {
  let detail = "(unreadable body)";
  try {
    const raw = (await request.text()).slice(0, MAX_BODY);
    try {
      const record = unwrapReport(JSON.parse(raw) as unknown);
      detail = JSON.stringify({
        blocked: record["blocked-uri"],
        directive: record["violated-directive"] ?? record["effective-directive"],
        document: record["document-uri"],
      });
    } catch {
      detail = raw;
    }
  } catch {
    // keep the default detail string
  }
  logWarn("csp", "violation-report", { detail });
  return new Response(null, { status: 204 });
}
