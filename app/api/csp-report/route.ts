// app/api/csp-report/route.ts
// POST-only collector for Content-Security-Policy violation reports (see
// the report-uri + report-to directives in next.config.js). Browsers POST
// a JSON body here whenever the (now enforcing) policy blocks something.
// We log a compact one-line summary through lib/logging.ts so it is
// searchable in Vercel Logs, then return 204 immediately.
//
// Now unwraps BOTH report shapes:
//   - legacy report-uri:  {"csp-report": {...}}
//   - Reporting API:      [{ type, body: {...} }]  (report-to)
// so a browser that only speaks report-to still produces a useful log
// line instead of an opaque envelope.
//
// Deliberately:
//   - No auth: reports are posted by browsers with no app session. The
//     body is attacker-controllable in principle, so it is only ever
//     logged as an opaque string, never parsed into logic.
//   - Body capped at 4KB before logging, so a hostile page cannot use
//     this as an unbounded log-flood sink.
import { logWarn } from "@/lib/logging";

const MAX_BODY = 4096;

function extractRecord(parsed: unknown): Record<string, unknown> {
  if (Array.isArray(parsed)) {
    const first = parsed[0];
    if (first && typeof first === "object") {
      const body = (first as { body?: unknown }).body;
      if (body && typeof body === "object") return body as Record<string, unknown>;
      return first as Record<string, unknown>;
    }
    return {};
  }
  if (parsed && typeof parsed === "object") {
    const legacy = (parsed as { "csp-report"?: unknown })["csp-report"];
    if (legacy && typeof legacy === "object") return legacy as Record<string, unknown>;
    return parsed as Record<string, unknown>;
  }
  return {};
}

export async function POST(request: Request) {
  let detail = "(unreadable body)";
  try {
    const raw = (await request.text()).slice(0, MAX_BODY);
    try {
      const record = extractRecord(JSON.parse(raw) as unknown);
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
