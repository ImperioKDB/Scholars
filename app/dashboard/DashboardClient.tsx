"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScholarshipCard, type CardScholarship } from "@/components/ScholarshipCard";
import { daysUntil, formatDeadlineLabel } from "@/lib/dates";
import type { GapNudge } from "@/lib/matching/gaps";

type MatchTier = "excellent" | "good" | "possible" | "unlikely";

type MatchApiItem = CardScholarship & {
  score: number;
  rankScore: number;
  tier: MatchTier;
  requirements: { status: "met" | "not_met" | "missing_data" | "unverifiable"; label: string }[];
};

type SavedApiItem = {
  id: string;
  saved_at: string;
  scholarship: CardScholarship;
};

const TABS: { value: "all" | MatchTier; label: string }[] = [
  { value: "all", label: "All matches" },
  { value: "excellent", label: "Excellent fit" },
  { value: "good", label: "Worth a look" },
  { value: "possible", label: "Possible" },
];

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function StatTile({
  value,
  label,
  tone = "navy",
}: {
  value: string | number;
  label: string;
  tone?: "navy" | "amber" | "emerald";
}) {
  const toneClass = tone === "amber" ? "text-amber" : tone === "emerald" ? "text-emerald" : "text-navy";
  return (
    <div className="bg-white rounded-xl border border-hairline p-4">
      <p className={`font-mono text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="text-xs text-navy-light mt-1">{label}</p>
    </div>
  );
}

// A single actionable nudge: "N scholarships would move to a better tier
// if you filled in X." scholarshipCount comes straight from
// lib/matching/gaps.ts's simulation against the student's real matches --
// never a made-up number.
function GapNudgeBanner({ gaps }: { gaps: GapNudge[] }) {
  if (gaps.length === 0) return null;
  const top = gaps[0];
  const rest = gaps.slice(1, 3);

  return (
    <div className="bg-emerald-light border border-emerald/20 rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            Add your <span className="text-emerald">{top.label.toLowerCase()}</span> — {top.scholarshipCount}{" "}
            scholarship{top.scholarshipCount === 1 ? "" : "s"} would move to a better match tier.
          </p>
          {rest.length > 0 && (
            <p className="text-xs text-navy-light mt-1.5">
              Also worth adding: {rest.map((g) => `${g.label.toLowerCase()} (+${g.scholarshipCount})`).join(", ")}
            </p>
          )}
        </div>
        <Link
          href={`/onboarding?step=${top.onboardingStep}`}
          className="shrink-0 text-xs font-medium text-white bg-emerald rounded-full px-4 py-2 hover:opacity-90 transition-opacity"
        >
          Add it now
        </Link>
      </div>
    </div>
  );
}

// Receives everything it needs to paint immediately from the server
// component (app/dashboard/page.tsx) -- there is no fetch-on-mount
// waterfall here. Only user-triggered mutations (saving/unsaving a
// scholarship) hit the network client-side; those still go through the
// existing /api/scholarships/save route, unchanged.
export function DashboardClient({
  fullName,
  initialMatches,
  initialProfileCompleteness,
  initialSaved,
  initialError,
  gaps,
}: {
  fullName: string | null;
  initialMatches: MatchApiItem[];
  initialProfileCompleteness: number;
  initialSaved: SavedApiItem[];
  initialError: string | null;
  gaps: GapNudge[];
}) {
  const router = useRouter();

  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [matches] = useState<MatchApiItem[]>(initialMatches);
  const [profileCompleteness] = useState(initialProfileCompleteness);
  const [saved, setSaved] = useState<SavedApiItem[]>(initialSaved);
  const [savedIds, setSavedIds] = useState<Set<string>>(
    new Set(initialSaved.map((s) => s.scholarship.id))
  );
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"all" | MatchTier>("all");

  async function refreshSaved() {
    const res = await fetch("/api/scholarships/save");
    if (!res.ok) return;
    const data = await res.json();
    const list: SavedApiItem[] = data.saved ?? [];
    setSaved(list);
    setSavedIds(new Set(list.map((s) => s.scholarship.id)));
  }

  const filteredMatches = useMemo(
    () => (tab === "all" ? matches : matches.filter((m) => m.tier === tab)),
    [matches, tab]
  );

  const upcomingDeadlines = useMemo(() => {
    const map = new Map<string, CardScholarship>();
    for (const m of matches) map.set(m.id, m);
    for (const s of saved) map.set(s.scholarship.id, s.scholarship);

    return [...map.values()]
      .filter((s) => {
        const days = daysUntil(s.deadline);
        return days !== null && days >= 0;
      })
      .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime())
      .slice(0, 5);
  }, [matches, saved]);

  const closingSoonCount = useMemo(() => {
    const ids = new Set<string>();
    for (const m of matches) {
      const days = daysUntil(m.deadline);
      if (days !== null && days >= 0 && days <= 30) ids.add(m.id);
    }
    for (const s of saved) {
      const days = daysUntil(s.scholarship.deadline);
      if (days !== null && days >= 0 && days <= 30) ids.add(s.scholarship.id);
    }
    return ids.size;
  }, [matches, saved]);

  async function toggleSave(scholarshipId: string) {
    const wasSaved = savedIds.has(scholarshipId);

    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(scholarshipId);
      else next.add(scholarshipId);
      return next;
    });
    setPendingIds((prev) => new Set(prev).add(scholarshipId));

    const res = wasSaved
      ? await fetch(`/api/scholarships/save?scholarship_id=${scholarshipId}`, { method: "DELETE" })
      : await fetch("/api/scholarships/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scholarship_id: scholarshipId }),
        });

    if (!res.ok) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(scholarshipId);
        else next.delete(scholarshipId);
        return next;
      });
    } else {
      await refreshSaved();
    }

    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(scholarshipId);
      return next;
    });
  }

  const firstName = fullName?.trim().split(/\s+/)[0];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-navy">
          {timeGreeting()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm text-navy-light mt-1 mb-6">
          {matches.length} eligible scholarship{matches.length === 1 ? "" : "s"} found.
        </p>

        {profileCompleteness < 100 && (
          <div className="bg-white rounded-xl border border-hairline p-5 mb-6">
            <div className="flex items-center justify-between mb-2 gap-3">
              <p className="text-sm font-medium text-ink">Your profile is {profileCompleteness}% complete</p>
              <Link href="/onboarding" className="text-sm font-medium text-navy hover:underline shrink-0">
                Finish it →
              </Link>
            </div>
            <div className="h-2 rounded-full bg-hairline overflow-hidden">
              <div className="h-full rounded-full bg-amber" style={{ width: `${profileCompleteness}%` }} />
            </div>
            <p className="text-xs text-navy-light mt-2">
              A fuller profile means more accurate match scores — you can browse now and finish it anytime.
            </p>
          </div>
        )}

        <GapNudgeBanner gaps={gaps} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile value={matches.length} label="Matches found" />
          <StatTile value={closingSoonCount} label="Closing within 30 days" tone={closingSoonCount > 0 ? "amber" : "navy"} />
          <StatTile value={saved.length} label="Saved" />
          <StatTile
            value={`${profileCompleteness}%`}
            label="Profile complete"
            tone={profileCompleteness === 100 ? "emerald" : "amber"}
          />
        </div>
      </div>

      {loadError && (
        <p className="text-sm text-rose mb-6">
          {loadError}{" "}
          <button
            type="button"
            onClick={() => {
              setLoadError(null);
              router.refresh();
            }}
            className="font-medium underline"
          >
            Try again
          </button>
        </p>
      )}

      {upcomingDeadlines.length > 0 && (
        <div className="mb-10">
          <h2 className="font-display text-lg font-semibold text-navy mb-3">Upcoming deadlines</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {upcomingDeadlines.map((s) => {
              const days = daysUntil(s.deadline) as number;
              return (
                <div key={s.id} className="shrink-0 w-56 bg-white rounded-xl border border-hairline p-4">
                  <p className="font-mono text-xs text-rose font-medium mb-1">{formatDeadlineLabel(days)}</p>
                  <p className="text-sm font-medium text-ink leading-snug line-clamp-2">{s.title}</p>
                  <p className="text-xs text-navy-light mt-1">{s.provider_name}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={
              "text-sm font-medium px-3 py-1.5 rounded-full transition-colors " +
              (tab === t.value ? "bg-navy text-white" : "text-navy-light hover:bg-navy-50")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {filteredMatches.length === 0 ? (
        <div className="bg-white rounded-xl border border-hairline p-8 text-center mb-12">
          <p className="text-sm text-navy-light">
            {matches.length === 0
              ? "No eligible matches yet. Fill in a few more profile details, or check back as new scholarships are added."
              : "No matches in this category."}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 mb-12">
          {filteredMatches.map((m) => {
            const met = m.requirements.filter((r) => r.status === "met").length;
            const total = m.requirements.filter((r) => r.status !== "unverifiable").length;
            const missingLabels = m.requirements.filter((r) => r.status === "missing_data").map((r) => r.label);
            return (
              <ScholarshipCard
                key={m.id}
                scholarship={m}
                score={m.score}
                metCount={met}
                totalCount={total}
                missingLabels={missingLabels}
                saved={savedIds.has(m.id)}
                pending={pendingIds.has(m.id)}
                onToggleSave={() => toggleSave(m.id)}
              />
            );
          })}
        </div>
      )}

      <h2 id="saved" className="font-display text-lg font-semibold text-navy mb-5 scroll-mt-20">
        Saved ({saved.length})
      </h2>

      {saved.length === 0 ? (
        <div className="bg-white rounded-xl border border-hairline p-8 text-center">
          <p className="text-sm text-navy-light">
            Save scholarships from your matches above to track their deadlines here.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {saved.map((s) => (
            <ScholarshipCard
              key={s.scholarship.id}
              scholarship={s.scholarship}
              saved
              pending={pendingIds.has(s.scholarship.id)}
              onToggleSave={() => toggleSave(s.scholarship.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
