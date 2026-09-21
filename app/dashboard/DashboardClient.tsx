"use client";
import { StatusMessage } from "@/components/StatusMessage";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScholarshipCard, Spinner, type CardScholarship } from "@/components/ScholarshipCard";
import { WhatsappOptIn } from "@/components/WhatsappOptIn";
import { consumeReturnScroll, saveReturnScroll } from "@/lib/scrollRestore";
import { daysUntil, formatDeadlineLabel } from "@/lib/dates";
import { track } from "@/lib/analytics";
import type { GapNudge } from "@/lib/matching/gaps";
import { fetchWithTimeout, FetchTimeoutError, FetchNetworkError } from "@/lib/fetch";
type MatchTier = "excellent" | "good" | "possible" | "unlikely";
type MatchApiItem = CardScholarship & {
  score: number;
  rankScore: number;
  tier: MatchTier;
  requirements: { status: "met" | "not_met" | "missing_data" | "unverifiable"; label: string }[];
};
type SavedApiItem = { id: string; saved_at: string; scholarship: CardScholarship };
const TABS: { value: "all" | MatchTier; label: string }[] = [
  { value: "all", label: "All matches" },
  { value: "excellent", label: "Excellent fit" },
  { value: "good", label: "Worth a look" },
  { value: "possible", label: "Possible" },
];
const SPINNER_DELAY_MS = 150;
// Once per browser session, not once per mount: returning to the dashboard
// ten times in a sitting must not produce ten funnel events.
const PMV_SESSION_KEY = "scholars:pmv_tracked";
function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
function StatTile({ value, label, tone = "navy" }: { value: string | number; label: string; tone?: "navy" | "amber" | "emerald" }) {
  const toneClass = tone === "amber" ? "text-amber" : tone === "emerald" ? "text-emerald" : "text-navy";
  return (
    <div className="bg-white rounded-2xl border border-hairline p-4 shadow-[0_1px_2px_rgba(11,30,61,0.03)] min-h-[92px] flex flex-col justify-center">
      <p className={`font-mono text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="text-xs text-navy-light mt-1">{label}</p>
    </div>
  );
}
function WeeklyFocus({ profileCompleteness, onboardingStep, matches, savedCount, closingSoonCount }: {
  profileCompleteness: number;
  onboardingStep: number;
  matches: MatchApiItem[];
  savedCount: number;
  closingSoonCount: number;
}) {
  const action = profileCompleteness < 100
    ? { title: "Finish your profile", detail: `${100 - profileCompleteness}% more detail unlocks more precise matches.`, href: `/onboarding?step=${Math.min(onboardingStep, 4)}`, label: "Resume profile", id: "resume_onboarding" }
    : savedCount === 0
    ? { title: "Save your first opportunity", detail: "Keep a shortlist so you can return when deadlines get closer.", href: "#matches", label: "Browse matches", id: "browse_matches" }
    : closingSoonCount > 0
    ? { title: "Review closing opportunities", detail: `${closingSoonCount} matched scholarship${closingSoonCount === 1 ? " is" : "s are"} closing within 30 days.`, href: "#deadlines", label: "Check deadlines", id: "review_deadlines" }
    : { title: "Refresh your shortlist", detail: "Open a new match and decide whether it belongs in your funding plan.", href: "#matches", label: "See matches", id: "refresh_shortlist" };
  return (
    <div className="grid grid-cols-1 gap-5 mb-10">
      <div className="rounded-2xl bg-navy text-white p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-white/65">Your focus this week</p>
        <h2 className="font-display text-xl font-semibold mt-2">{action.title}</h2>
        <p className="text-sm text-white/75 mt-1 max-w-md">{action.detail}</p>
        <Link href={action.href} onClick={() => track("weekly_focus_actioned", { action: action.id })} className="inline-flex mt-5 rounded-seal bg-white text-navy text-sm font-medium px-4 py-2.5 hover:bg-navy-50 transition-colors">
          {action.label} <span aria-hidden="true" className="ml-2">&rarr;</span>
        </Link>
      </div>
      <Link
        href="/dashboard/fresh-matches"
        onClick={() => track("weekly_focus_actioned", { action: "open_fresh_matches" })}
        aria-label="Review all fresh scholarship matches"
        className="group block rounded-2xl border border-hairline bg-white p-5 sm:p-6 transition-[border-color,box-shadow,transform] duration-150 hover:border-navy/25 hover:shadow-card active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald"
      >
        <p className="text-xs uppercase tracking-[0.16em] text-navy-light">Fresh matches</p>
        <p className="text-sm text-navy-light mt-1 mb-3">A short list to review now. Tap to see all details.</p>
        <div className="space-y-3">
          {matches.slice(0, 3).map((match) => (
            <span key={`fresh-match-${match.id}`} className="block truncate text-sm font-medium text-ink group-hover:text-navy">
              {match.title}
            </span>
          ))}
          {matches.length === 0 && <p className="text-sm text-navy-light">Complete a few profile fields to unlock fresh matches.</p>}
        </div>
        {matches.length > 0 && <span className="mt-4 inline-flex text-sm font-medium text-navy">Review fresh matches <span aria-hidden="true" className="ml-2">&rarr;</span></span>}
      </Link>
    </div>
  );
}
function GapNudgeBanner({ gaps }: { gaps: GapNudge[] }) {
  if (gaps.length === 0) return null;
  const top = gaps[0];
  const rest = gaps.slice(1, 3);
  return (
    <div className="bg-emerald-light border border-emerald/20 rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            Add your <span className="text-emerald">{top.label.toLowerCase()}</span> -- {top.scholarshipCount}{" "}
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
          onClick={() =>
            track("gap_nudge_clicked", {
              field: top.field,
              scholarships: top.scholarshipCount,
            })
          }
          className="shrink-0 text-xs font-medium text-white bg-emerald rounded-full px-4 py-2 hover:opacity-90 transition-opacity"
        >
          Add it now
        </Link>
      </div>
    </div>
  );
}
function DeadlineCard({ scholarship, days }: { scholarship: CardScholarship; days: number }) {
  const [navigating, setNavigating] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const spinnerTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (spinnerTimeout.current) clearTimeout(spinnerTimeout.current); }, []);
  function handleNavigate() {
    setNavigating(true);
    spinnerTimeout.current = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
  }
  return (
    <div className={[
      "relative w-full bg-white rounded-xl border border-hairline p-4",
      "transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
      "active:scale-[0.97]",
      navigating ? "scale-[0.97] opacity-80" : "scale-100 opacity-100",
    ].join(" ")}>
      <Link
        href={`/scholarships/${scholarship.id}`}
        aria-label={scholarship.title}
        className="absolute inset-0 z-0 rounded-xl"
        onClick={() => { saveReturnScroll(); handleNavigate(); }}
      >
        <span className="sr-only">{scholarship.title}</span>
      </Link>
      <div className="pointer-events-none">
        <p className="font-mono text-xs text-rose font-medium mb-1">{formatDeadlineLabel(days)}</p>
        <p className="text-sm font-medium text-ink leading-snug line-clamp-2">{scholarship.title}</p>
        <p className="text-xs text-navy-light mt-1">{scholarship.provider_name}</p>
      </div>
      {showSpinner && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px] pointer-events-none" aria-hidden="true">
          <Spinner className="h-4 w-4 text-navy" />
        </div>
      )}
    </div>
  );
}
export function DashboardClient({
  userId, fullName, initialMatches, initialProfileCompleteness, initialSaved, initialError, gaps, whatsappOptIn, onboardingStep,
}: {
  userId: string;
  fullName: string | null;
  initialMatches: MatchApiItem[];
  initialProfileCompleteness: number;
  initialSaved: SavedApiItem[];
  initialError: string | null;
  gaps: GapNudge[];
  whatsappOptIn: boolean;
  onboardingStep: number;
}) {
  const router = useRouter();
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [matches] = useState<MatchApiItem[]>(initialMatches);
  const [profileCompleteness] = useState(initialProfileCompleteness);
  const [saved, setSaved] = useState<SavedApiItem[]>(initialSaved);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(initialSaved.map((s) => s.scholarship.id)));
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"all" | MatchTier>("all");
  useEffect(() => {
    const y = consumeReturnScroll("/dashboard");
    if (y === null) return;
    const raf = requestAnimationFrame(() => window.scrollTo(0, y));
    return () => cancelAnimationFrame(raf);
  }, []);
  // PHASE 1 funnel event: an incomplete profile that already has real
  // matches has seen the value proposition. Track once per session.
  useEffect(() => {
    if (initialProfileCompleteness >= 100 || initialMatches.length === 0) return;
    try {
      if (sessionStorage.getItem(PMV_SESSION_KEY)) return;
      sessionStorage.setItem(PMV_SESSION_KEY, "1");
    } catch {
      // storage blocked: fall through and track once per mount
    }
    track("provisional_matches_viewed", {
      completeness: initialProfileCompleteness,
      matches: initialMatches.length,
    });
  }, [initialProfileCompleteness, initialMatches.length]);
  useEffect(() => {
    track("weekly_focus_viewed", {
      completeness: initialProfileCompleteness,
      saved: initialSaved.length,
      matches: initialMatches.length,
    });
  }, [initialProfileCompleteness, initialSaved.length, initialMatches.length]);
  async function refreshSaved() {
    try {
      const res = await fetchWithTimeout("/api/scholarships/save");
      if (!res.ok) return;
      const data = await res.json();
      const list: SavedApiItem[] = data.saved ?? [];
      setSaved(list);
      setSavedIds(new Set(list.map((s) => s.scholarship.id)));
    } catch (err) {
      // Silent fail -- saved list is supplementary
    }
  }
  const openMatches = useMemo(() => matches.filter((m) => m.isOpenNow), [matches]);
  const comingSoon = useMemo(() => matches.filter((m) => !m.isOpenNow), [matches]);
  const filteredMatches = useMemo(
    () => (tab === "all" ? openMatches : openMatches.filter((m) => m.tier === tab)),
    [openMatches, tab]
  );
  const tabCounts = useMemo(() => ({
    all: openMatches.length,
    excellent: openMatches.filter((m) => m.tier === "excellent").length,
    good: openMatches.filter((m) => m.tier === "good").length,
    possible: openMatches.filter((m) => m.tier === "possible").length,
    unlikely: openMatches.filter((m) => m.tier === "unlikely").length,
  }), [openMatches]);
  const upcomingDeadlines = useMemo(() => {
    const map = new Map<string, CardScholarship>();
    for (const m of matches) map.set(m.id, m);
    for (const s of saved) map.set(s.scholarship.id, s.scholarship);
    return [...map.values()]
      .filter((s) => { const d = daysUntil(s.deadline); return d !== null && d >= 0; })
      .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime())
      .slice(0, 5);
  }, [matches, saved]);
  const closingSoonCount = useMemo(() => {
    const ids = new Set<string>();
    for (const m of matches) { const d = daysUntil(m.deadline); if (d !== null && d >= 0 && d <= 30) ids.add(m.id); }
    for (const s of saved) { const d = daysUntil(s.scholarship.deadline); if (d !== null && d >= 0 && d <= 30) ids.add(s.scholarship.id); }
    return ids.size;
  }, [matches, saved]);
  async function toggleSave(scholarshipId: string) {
    const wasSaved = savedIds.has(scholarshipId);
    setSavedIds((prev) => { const n = new Set(prev); if (wasSaved) n.delete(scholarshipId); else n.add(scholarshipId); return n; });
    setPendingIds((prev) => new Set(prev).add(scholarshipId));
    try {
      const res = wasSaved
        ? await fetchWithTimeout(`/api/scholarships/save?scholarship_id=${scholarshipId}`, { method: "DELETE" })
        : await fetchWithTimeout("/api/scholarships/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scholarship_id: scholarshipId }),
          });
      if (!res.ok) {
        setSavedIds((prev) => { const n = new Set(prev); if (wasSaved) n.add(scholarshipId); else n.delete(scholarshipId); return n; });
      } else {
        await refreshSaved();
      }
    } catch (err) {
      // Revert on network error
      setSavedIds((prev) => { const n = new Set(prev); if (wasSaved) n.add(scholarshipId); else n.delete(scholarshipId); return n; });
    }
    setPendingIds((prev) => { const n = new Set(prev); n.delete(scholarshipId); return n; });
  }
  const firstName = fullName?.trim().split(/\s+/)[0];
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl leading-tight font-semibold text-navy">{timeGreeting()}{firstName ? `, ${firstName}` : ""}</h1>
        <p className="text-sm text-navy-light mt-1 mb-6">{openMatches.length} open scholarship{openMatches.length === 1 ? "" : "s"} you can apply to now.</p>
        {profileCompleteness < 100 && (
          <div className="bg-white rounded-2xl border border-hairline p-5 mb-6 shadow-[0_1px_2px_rgba(11,30,61,0.03)]">
            <div className="flex items-center justify-between mb-2 gap-3">
              <p className="text-sm font-medium text-ink">Your profile is {profileCompleteness}% complete</p>
              <Link href="/onboarding" className="text-sm font-medium text-navy hover:underline shrink-0">Finish it &rarr;</Link>
            </div>
            <div className="h-2 rounded-full bg-hairline overflow-hidden">
              <div className="h-full rounded-full bg-amber" style={{ width: `${profileCompleteness}%` }} />
            </div>
            <p className="text-xs text-navy-light mt-2">A fuller profile means more accurate match scores -- you can browse now and finish it anytime.</p>
          </div>
        )}
        <GapNudgeBanner gaps={gaps} />
        <WhatsappOptIn initialOptIn={whatsappOptIn} />
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          <StatTile value={openMatches.length} label="Open now" />
          <StatTile value={comingSoon.length} label="Coming soon" tone={comingSoon.length > 0 ? "amber" : "navy"} />
          <StatTile value={closingSoonCount} label="Closing within 30 days" tone={closingSoonCount > 0 ? "amber" : "navy"} />
          <StatTile value={saved.length} label="Saved" />
        </div>
      </div>
      <div id="matches">
        <WeeklyFocus profileCompleteness={profileCompleteness} onboardingStep={onboardingStep} matches={matches} savedCount={saved.length} closingSoonCount={closingSoonCount} />
      </div>
      {loadError && (
        <StatusMessage tone="error" className="mb-6">
          {loadError}{" "}
          <button type="button" onClick={() => { setLoadError(null); router.refresh(); }} className="font-medium underline">Try again</button>
        </StatusMessage>
      )}
      {upcomingDeadlines.length > 0 && (
        <div id="deadlines" className="mb-10 scroll-mt-6">
          <h2 className="font-display text-lg font-semibold text-navy mb-3">Upcoming deadlines</h2>
          <div className="space-y-3 max-w-3xl">
            {upcomingDeadlines.map((s) => (
              <DeadlineCard key={s.id} scholarship={s} days={daysUntil(s.deadline) as number} />
            ))}
          </div>
        </div>
      )}
      <div className="mb-5">
        <div className="flex items-end justify-between gap-4 mb-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-navy-light">Your matches</p>
            <p className="text-sm text-navy-light mt-1">Browse by confidence</p>
          </div>
          <span className="shrink-0 text-xs font-mono text-navy-light">{filteredMatches.length} shown</span>
        </div>
        <div role="tablist" aria-label="Filter scholarship matches" className="flex gap-1.5 overflow-x-auto rounded-2xl bg-navy-50 p-1.5 scrollbar-none">
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.value)}
                className={[
                  "inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150",
                  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald",
                  active ? "bg-white text-navy shadow-[0_1px_3px_rgba(11,30,61,0.14)]" : "text-navy-light hover:bg-white/70 hover:text-navy",
                ].join(" ")}
              >
                <span>{t.label}</span>
                <span className={active ? "rounded-full bg-navy px-1.5 py-0.5 text-[11px] leading-none text-white" : "rounded-full bg-white/70 px-1.5 py-0.5 text-[11px] leading-none text-navy-light"}>
                  {tabCounts[t.value]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {filteredMatches.length === 0 ? (
        <div className="bg-white rounded-xl border border-hairline p-8 text-center mb-12">
          <p className="text-sm text-navy-light">
            {openMatches.length === 0 && comingSoon.length > 0
              ? "Nothing you can apply to right now, but the scholarships below are verified and return regularly. Save one and get your documents ready."
              : openMatches.length === 0
              ? "No eligible matches yet. Fill in a few more profile details, or check back as new scholarships are added."
              : "No matches in this category."}
          </p>
        </div>
      ) : (
        <div key={tab} className="grid grid-cols-1 gap-4 mb-12">
          {filteredMatches.map((m, i) => {
            const met = m.requirements.filter((r) => r.status === "met").length;
            const total = m.requirements.filter((r) => r.status !== "unverifiable").length;
            const missingLabels = m.requirements.filter((r) => r.status === "missing_data").map((r) => r.label);
            return (
              <div key={m.id} className="animate-card-in" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <ScholarshipCard scholarship={m} score={m.score} metCount={met} totalCount={total} missingLabels={missingLabels}
                  saved={savedIds.has(m.id)} pending={pendingIds.has(m.id)} onToggleSave={() => toggleSave(m.id)} sharerId={userId} />
              </div>
            );
          })}
        </div>
      )}
      {comingSoon.length > 0 && (
        <div className="mb-12">
          <h2 className="font-display text-lg font-semibold text-navy mb-1">Coming soon</h2>
          <p className="text-sm text-navy-light mb-4">Verified scholarships that aren&apos;t accepting applications right now. Save one to keep it on your radar while you get ready.</p>
          <div className="grid grid-cols-1 gap-4">
            {comingSoon.map((m) => {
              const met = m.requirements.filter((r) => r.status === "met").length;
              const total = m.requirements.filter((r) => r.status !== "unverifiable").length;
              const missingLabels = m.requirements.filter((r) => r.status === "missing_data").map((r) => r.label);
              return (
                <ScholarshipCard key={m.id} scholarship={m} score={m.score} metCount={met} totalCount={total} missingLabels={missingLabels}
                  saved={savedIds.has(m.id)} pending={pendingIds.has(m.id)} onToggleSave={() => toggleSave(m.id)} sharerId={userId} />
              );
            })}
          </div>
        </div>
      )}
      <h2 id="saved" className="font-display text-lg font-semibold text-navy mb-5 scroll-mt-20">Saved ({saved.length})</h2>
      {saved.length === 0 ? (
        <div className="bg-white rounded-xl border border-hairline p-8 text-center">
          <p className="text-sm text-navy-light">Save scholarships from your matches above to track their deadlines here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 max-w-4xl">
          {saved.map((s) => (
            <ScholarshipCard key={s.scholarship.id} scholarship={s.scholarship} saved pending={pendingIds.has(s.scholarship.id)} onToggleSave={() => toggleSave(s.scholarship.id)} sharerId={userId} />
          ))}
        </div>
      )}
    </div>
  );
}
