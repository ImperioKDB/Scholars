"use client";
// components/ShareButton.tsx
//
// Two render variants sharing one share action:
//   "full" -- labeled button, used on detail pages
//   "icon" -- compact circular icon button, used on ScholarshipCard /
//             OpportunityCard
//
// Builds a link to the public, unauthenticated share landing page --
// /s/[id] for scholarships, /o/[id] for opportunities (see
// app/s/[id]/page.tsx, app/o/[id]/page.tsx) -- tagged with
// ?ref=<sharerId> for referral attribution (middleware.ts +
// app/auth/callback/route.ts). Prefers the native OS share sheet
// (navigator.share); falls back to a direct wa.me deep link only when the
// Web Share API isn't available.
//
// Also fires a fire-and-forget POST to /api/xp/share when sharerId is
// present -- the small, deliberately cheap share XP award. Scholarship and
// opportunity shares dedupe separately but count against the same daily
// cap. Never awaited before opening the share sheet (XP is a bonus, not a
// gate on the actual share action), and its failure is swallowed silently
// -- same best-effort posture as Ade's own network calls elsewhere in this
// app.
//
// BACKWARD COMPATIBLE: existing scholarship callers pass scholarshipId and
// nothing else. New opportunity callers pass opportunityId instead. When
// opportunityId is present the button targets /o/[id] and posts
// { opportunity_id }; otherwise it targets /s/[id] and posts
// { scholarship_id } exactly as before.
type ShareButtonProps = {
  scholarshipId?: string;
  opportunityId?: string;
  title: string;
  sharerId?: string;
  variant?: "full" | "icon";
};

function buildShareUrl(pathPrefix: string, id: string, sharerId?: string): string {
  const url = new URL(pathPrefix + id, window.location.origin);
  if (sharerId) url.searchParams.set("ref", sharerId);
  return url.toString();
}

async function performShare(url: string, text: string) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: text, url });
    } catch {
      // User cancelled the native share sheet -- not an error, nothing to do.
    }
    return;
  }
  window.open("https://wa.me/?text=" + encodeURIComponent(text + " " + url), "_blank", "noreferrer");
}

export function ShareButton({ scholarshipId, opportunityId, title, sharerId, variant = "full" }: ShareButtonProps) {
  const isOpportunity = Boolean(opportunityId);
  const entityId = (opportunityId ?? scholarshipId) as string;

  async function handleShare(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (!entityId) return;
    if (sharerId) {
      fetch("/api/xp/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isOpportunity ? { opportunity_id: entityId } : { scholarship_id: entityId }
        ),
      }).catch(() => {});
    }
    const url = buildShareUrl(isOpportunity ? "/o/" : "/s/", entityId, sharerId);
    const text = isOpportunity
      ? title + " -- find it on Scholars"
      : title + " -- check if you qualify on Scholars";
    await performShare(url, text);
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleShare}
        aria-label={isOpportunity ? "Share this opportunity" : "Share this scholarship"}
        // 44x44 tap target (product audit / WCAG 2.5.5): visible circle
        // stays 30px; the ::after pseudo extends the hit area to 44px
        // without touching layout. Card corner spacing keeps the expanded
        // hit areas of share + save from overlapping.
        className="relative shrink-0 rounded-full p-1.5 bg-white/90 backdrop-blur-sm text-navy-light hover:text-navy transition-colors after:absolute after:-inset-[7px] after:rounded-full after:content-['']"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 10.5l6.8-3.8M8.6 13.5l6.8 3.8" strokeLinecap="round" />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="rounded-seal text-sm font-medium px-5 py-2.5 border border-hairline text-navy-light hover:border-navy/40 transition-colors inline-flex items-center gap-2"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 10.5l6.8-3.8M8.6 13.5l6.8 3.8" strokeLinecap="round" />
      </svg>
      Share
    </button>
  );
}
