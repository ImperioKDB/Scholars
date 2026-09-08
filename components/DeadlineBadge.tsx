// components/DeadlineBadge.tsx
// Shared deadline pill. The tone map + badge markup were previously
// duplicated in ScholarshipCard, ScholarshipDetailClient,
// ApplicationsClient and the landing page; one component keeps the
// color language and the copy ("Closed" / "Today" / "N days left")
// identical everywhere. Renders nothing when there is no deadline.
import { daysUntil, deadlineTone, formatDeadlineLabel } from "@/lib/dates";

export const DEADLINE_TONE_CLASSES: Record<ReturnType<typeof deadlineTone>, string> = {
  closed: "bg-hairline text-navy-light",
  urgent: "bg-rose-light text-rose",
  soon: "bg-amber-light text-amber",
  later: "bg-navy-50 text-navy-light",
};

export function DeadlineBadge({ deadline }: { deadline: string | null }) {
  const days = daysUntil(deadline);
  if (days === null) return null;
  return (
    <span className={`text-xs font-mono font-medium px-2 py-1 rounded-full ${DEADLINE_TONE_CLASSES[deadlineTone(days)]}`}>
      {formatDeadlineLabel(days)}
    </span>
  );
}
