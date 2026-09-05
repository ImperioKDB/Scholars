"use client";

import { useEffect, useRef, useState } from "react";
import { ScholarshipCard, type CardScholarship } from "@/components/ScholarshipCard";

// app/discover/DiscoverClient.tsx
//
// Browse/search client for /discover. Fetches from GET /api/scholarships
// (the dumb catalog endpoint -- no eligibility scoring; that stays the
// dashboard's job). Keyword search hits title + provider name via the
// route's `q` param (added in batch 4); level and discipline map to the
// route's existing filters.
//
// Cards render in the unscored variant (no `score` prop, so they show a
// provider monogram instead of a MatchSeal), because a catalog listing
// has no per-item profile evaluation behind it -- printing a number here
// would mean fabricating one.

const LEVEL_OPTIONS = [
  { value: "", label: "All levels" },
  { value: "undergrad", label: "Undergraduate only" },
  { value: "both", label: "Open to undergrad & postgrad" },
] as const;

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

export function DiscoverClient({
  userId,
  initialSavedIds,
}: {
  userId: string;
  initialSavedIds: string[];
}) {
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
    // Stale-response guard: a slow earlier request must never overwrite
    // the results of a newer one.
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

  // Debounce typing instead of firing a request per keystroke. Also
  // drives the initial load on mount.
  useEffect(() => {
    const t = setTimeout(() => load(0, true), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, level, discipline]);

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
          Every verified listing on Scholars. Your personalized matches live on the dashboard; this is the
          full catalog.
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
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
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
          <p className="text-sm text-navy-light">
            No scholarships match that search. Try fewer filters or a different keyword.
          </p>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {items.map((s) => (
              <ScholarshipCard
                key={s.id}
                scholarship={s}
                saved={savedIds.has(s.id)}
                pending={pendingIds.has(s.id)}
                onToggleSave={() => toggleSave(s.id)}
                sharerId={userId}
              />
            ))}
          </div>

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
            // COPY FIX (live feedback): the old end-of-list line read like
            // a debug readout ("That's everything for this search: 5
            // scholarships."). The catalog case now speaks like the
            // product, and the filtered case points at the filters
            // instead of promising notifications about a filtered view.
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
