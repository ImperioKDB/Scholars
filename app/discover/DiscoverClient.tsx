"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScholarshipCard, type CardScholarship } from "@/components/ScholarshipCard";
import { isCurrentlyOpen } from "@/lib/discovery";

const LEVEL_OPTIONS = [
  { value: "", label: "All levels" },
  { value: "undergrad", label: "Undergraduate only" },
  { value: "both", label: "Open to undergrad & postgrad" },
] as const;

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

export function DiscoverClient({ userId, initialSavedIds }: { userId: string; initialSavedIds: string[] }) {
  const [keyword, setKeyword] = useState("");
  const [level, setLevel] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [items, setItems] = useState<CardScholarship[]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(initialSavedIds));
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);

  const filtersActive = keyword.trim() !== "" || level !== "" || discipline.trim() !== "";

  async function load(offset: number, replace: boolean) {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("q", keyword.trim());
    if (level) params.set("level", level);
    if (discipline.trim()) params.set("discipline", discipline.trim());
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));

    const res = await fetch("/api/scholarships?" + params.toString());
    if (requestId !== requestIdRef.current) return;
    if (!res.ok) {
      setLoadError("Couldn't load scholarships. Try again.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    const page = (data.scholarships ?? []) as CardScholarship[];
    setItems((prev) => (replace ? page : [...prev, ...page]));
    setTotal(data.total ?? 0);
    setNextOffset(offset + page.length);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => load(0, true), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [keyword, level, discipline]);

  const openNowItems = useMemo(
    () => items.filter((s) => isCurrentlyOpen(s)).map((s) => ({ ...s, isOpenNow: true })),
    [items]
  );
  const comingSoonItems = useMemo(
    () => items.filter((s) => !isCurrentlyOpen(s)).map((s) => ({ ...s, isOpenNow: false })),
    [items]
  );

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
    }
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(scholarshipId);
      return next;
    });
  }

  const hasMore = nextOffset < total;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-navy">Browse scholarships</h1>
        <p className="text-sm text-navy-light mt-1 mb-6">
          Every verified listing on Scholars. Your personalized matches live on the dashboard; this is the full catalog.
        </p>
        <div className="bg-white rounded-xl border border-hairline p-4">
          <label className="block mb-3">
            <span className="sr-only">Search by scholarship name or provider</span>
            <input
              className="w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-navy-light/50 focus:border-navy outline-none transition-colors"
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search by scholarship name or provider, e.g. MTN"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              className="text-sm rounded-lg border border-hairline bg-white px-3 py-2"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              aria-label="Filter by level"
            >
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              className="text-sm rounded-lg border border-hairline bg-white px-3 py-2 w-full sm:w-72 placeholder:text-navy-light/50 focus:border-navy outline-none transition-colors"
              type="text"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              placeholder="Filter by course, e.g. Computer Science"
              aria-label="Filter by course"
            />
          </div>
        </div>
      </div>

      {loadError && <p className="text-sm text-rose mb-6">{loadError}</p>}

      {!loading && items.length === 0 && !loadError ? (
        <div className="bg-white rounded-xl border border-hairline p-8 text-center">
          <p className="text-sm text-navy-light">No scholarships match that search. Try fewer filters or a different keyword.</p>
        </div>
      ) : (
        <>
          {openNowItems.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              {openNowItems.map((s) => (
                <ScholarshipCard key={s.id} scholarship={s} saved={savedIds.has(s.id)} pending={pendingIds.has(s.id)} onToggleSave={() => toggleSave(s.id)} sharerId={userId} />
              ))}
            </div>
          )}

          {comingSoonItems.length > 0 && (
            <div className="mt-10">
              <h2 className="font-display text-lg font-semibold text-navy mb-1">Coming soon</h2>
              <p className="text-sm text-navy-light mb-4">
                Verified scholarships that aren&apos;t accepting applications yet. Save one to keep it on your radar.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {comingSoonItems.map((s) => (
                  <ScholarshipCard key={s.id} scholarship={s} saved={savedIds.has(s.id)} pending={pendingIds.has(s.id)} onToggleSave={() => toggleSave(s.id)} sharerId={userId} />
                ))}
              </div>
            </div>
          )}

          {loading && <p className="text-sm text-navy-light mt-6">Loading&hellip;</p>}

          {!loading && hasMore && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => load(nextOffset, false)}
                className="rounded-seal border border-hairline bg-white text-navy text-sm font-medium px-6 py-2.5 hover:bg-navy-50 transition-colors"
              >
                Load more ({total - nextOffset} remaining)
              </button>
            </div>
          )}

          {!loading && !hasMore && items.length > 0 && (
            <p className="text-sm text-navy-light text-center mt-8 leading-relaxed">
              {filtersActive
                ? "That is every match for these filters. Try clearing one to see more."
                : "That is all the scholarships for now. We'll notify you once a new one is available."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
