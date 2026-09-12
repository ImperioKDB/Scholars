// lib/cycles.ts
// Cycle prediction from observed cycle_events history. Pure functions, no
// DB access, so it is trivially testable and safe to call from any server
// component or route.
//
// Honesty rules (same posture as the matching engine):
//   - Two or more observed 'opened' events: confidence "observed", label
//     "Usually opens around <Month> <year>".
//   - One open, or only 'closed' events: confidence "estimated", label
//     "Next cycle likely around <Month> <year>". For close-only history the
//     open month is estimated as the last close month minus three (Nigerian
//     cyclical awards typically open a quarter before they close).
//   - No history at all: return null. No history, no prediction, no
//     invented date.
export type CycleEventKind = "opened" | "closed" | "deadline_set";
export type CycleEvent = {
  kind: CycleEventKind;
  event_date: string;
};
export type CyclePrediction = {
  label: string;
  monthLabel: string;
  year: number;
  confidence: "observed" | "estimated";
};
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function parseDate(eventDate: string): Date | null {
  const d = new Date(`${eventDate}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}
// Next occurrence of `month` at or after `now`, at day 1.
function nextOccurrence(month: number, now: Date): { month: number; year: number } {
  let year = now.getUTCFullYear();
  if (month < now.getUTCMonth()) year += 1;
  return { month, year };
}
export function predictNextCycle(events: CycleEvent[]): CyclePrediction | null {
  const now = new Date();
  const opens = events
    .filter((e) => e.kind === "opened")
    .map((e) => parseDate(e.event_date))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  const closes = events
    .filter((e) => e.kind === "closed")
    .map((e) => parseDate(e.event_date))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  if (opens.length > 0) {
    const month = median(opens.map((d) => d.getUTCMonth()));
    const next = nextOccurrence(month, now);
    const confidence = opens.length >= 2 ? "observed" : "estimated";
    return {
      label: `${confidence === "observed" ? "Usually opens around" : "Next cycle likely around"} ${MONTHS[month]} ${next.year}`,
      monthLabel: MONTHS[month],
      year: next.year,
      confidence,
    };
  }
  if (closes.length > 0) {
    const last = closes[closes.length - 1];
    const month = (last.getUTCMonth() + 9) % 12; // close month minus three
    let cand = new Date(Date.UTC(last.getUTCFullYear(), month, 1));
    while (cand.getTime() < now.getTime()) {
      cand = new Date(Date.UTC(cand.getUTCFullYear() + 1, month, 1));
    }
    return {
      label: `Next cycle likely around ${MONTHS[month]} ${cand.getUTCFullYear()}`,
      monthLabel: MONTHS[month],
      year: cand.getUTCFullYear(),
      confidence: "estimated",
    };
  }
  return null;
}
