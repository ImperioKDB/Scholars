// lib/dates.ts
// Small shared helpers for deadline math, used by the dashboard page and
// ScholarshipCard. Kept UTC-based so "today" doesn't shift depending on the
// server's local timezone vs. the student's.

export function daysUntil(deadline: string | null | undefined): number | null {
  if (!deadline) return null;

  const target = new Date(`${deadline}T00:00:00Z`).getTime();
  if (Number.isNaN(target)) return null;

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return Math.ceil((target - todayUtc) / (1000 * 60 * 60 * 24));
}

export function formatDeadlineLabel(days: number): string {
  if (days < 0) return "Closed";
  if (days === 0) return "Today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export function deadlineTone(days: number): "closed" | "urgent" | "soon" | "later" {
  if (days < 0) return "closed";
  if (days <= 7) return "urgent";
  if (days <= 30) return "soon";
  return "later";
}
