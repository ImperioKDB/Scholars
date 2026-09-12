// lib/analytics.ts
// Fire-and-forget product analytics (Phase 1). Never awaited, never
// blocks a flow, swallows every error: a failed track call must never
// surface to a student or break an action. keepalive lets the request
// survive navigation (e.g. tapping a gap nudge leaves the dashboard).
//
// Keep the EventName union in sync with the zod enum in
// app/api/events/route.ts and the events_event_whitelist check constraint
// in migration 0019. The DB constraint is the backstop if they drift.
export type EventName =
  | "provisional_matches_viewed"
  | "gap_nudge_clicked"
  | "whatsapp_opt_in"
  | "whatsapp_opt_out";
export type EventMeta = Record<string, string | number | boolean>;
export function track(event: EventName, meta?: EventMeta): void {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, meta: meta ?? {} }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // analytics must never throw
  }
}
