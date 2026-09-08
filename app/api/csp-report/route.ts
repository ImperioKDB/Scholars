// app/api/csp-report/route.ts
// POST-only collector for Content-Security-Policy violation reports (see
// the report-uri directive in next.config.js). Browsers send a JSON body
// here whenever the (currently Report-Only) policy WOULD have blocked
// something. We log a compact one-line summary through lib/logging.ts so
// it is searchable in Vercel Logs, then return 204 immediately.
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
//   - Accepts both report shapes: the legacy {"csp-report": {...}}
//     (report-uri) and the newer Reporting API array format.
import { logWarn } from "@/lib/logging";

const MAX_BODY = 4096;

export async function POST(request: Request) {
  let detail = "(unreadable body)";
  try {
    const raw = (await request.text()).slice(0, MAX_BODY);
    try {
      const parsed = JSON.parse(raw) as unknown;
      const record =
        (parsed as { "csp-report"?: Record<string, unknown> })["csp-report"] ??
        (Array.isArray(parsed) ? (parsed[0] as Record<string, unknown>) : (parsed as Record<string, unknown>));
      detail = JSON.stringify({
        blocked: record?.["blocked-uri"],
        directive: record?.["violated-directive"] ?? record?.["effective-directive"],
        document: record?.["document-uri"],
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
