"use client";

import { useEffect, useRef, useState } from "react";
import { OpportunityCard, type CardOpportunity } from "@/components/OpportunityCard";
import { OPPORTUNITY_TYPE_OPTIONS } from "@/lib/admin/opportunity";

// app/opportunities/OpportunitiesClient.tsx
//
// Browse/search client for /opportunities, mirroring DiscoverClient.
// Fetches from GET /api/opportunities (dumb catalog, no scoring) with
// keyword + type + discipline filters. Cards render via ProviderMonogram
// and a type badge -- never MatchSeal, since there is no eligibility score
// for these. A "Saved" section below the catalog mirrors the pattern
// already used on Dashboard and Applications for saved scholarships.
const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

type SavedApiItem = {
  id: string;
  saved_at: string;
  opportunity: CardOpportunity;
};

export function OpportunitiesClient({ initialSaved }: { initialSaved: SavedApiItem[] }) {
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [items, setItems] = useState<CardOpportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedApiItem[]>(initialSaved);
  const [savedIds, setSavedIds] = useState<Set<string>>(
    new Set(initialSaved.map((s) => s.opportunity.id))
  );
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);

  const filtersActive = keyword.trim() !== "" || type !== "" || discipline.trim() !== "";

  async function load(offset: number, replace: boolean) {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);

    const params = new URLSearchParams();
    if (keyword.trim()) params.set("q", keyword.trim());
    if (type) params.set("type", type);
    if (discipline.trim()) params.set("discipline", discipline.trim());
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));

    const res = await fetch("/api/opportunities?" + params.toString());
    // Stale-response guard: a slow earlier request must never overwrite
    // the results of a newer one.
    if (requestId !== requestIdRef.current) return;

    if (!res.ok) {
      setLoadError("Couldn't load opportunities. Try again.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    const page = (data.opportunities ?? []) as CardOpportunity[];
    setItems((prev) => (replace ? page : [...prev, ...page]));
    setTotal(data.total ?? 0);
    setNextOffset(offset + page.length);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => load(0, true), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, type, discipline]);

  async function refreshSaved() {
    const res = await fetch("/api/opportunities/save");
    if (!res.ok) return;
    const data = await res.json();
    const list: SavedApiItem[] = data.saved ?? [];
    setSaved(list);
    setSavedIds(new Set(list.map((s) => s.opportunity.id)));
  }

  async function toggleSave(opportunityId: string) {
    const wasSaved = savedIds.has(opportunityId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(opportunityId);
      else next.add(opportunityId);
      return next;
    });
    setPendingIds((prev) => new Set(prev).add(opportunityId));

    const res = wasSaved
      ? await fetch(`/api/opportunities/save?opportunity_id=${opportunityId}`, { method: "DELETE" })
      : await fetch("/api/opportunities/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunity_id: opportunityId }),
        });

    if (!res.ok) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(opportunityId);
        else next.delete(opportunityId);
        return next;
      });
    } else {
      await refreshSaved();
    }
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(opportunityId);
      return next;
    });
  }

  const hasMore = nextOffset < total;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-navy">Opportunities</h1>
        <p className="text-sm text-navy-light mt-1 mb-6">
          Fellowships, internships, competitions, and mentorships alongside your scholarship matches --
          verified, but not scored, since eligibility for these varies too much to gate automatically.
        </p>

        <div className="bg-white rounded-xl border border-hairline p-4">
          <label className="block mb-3">
            <span className="sr-only">Search by title or provider</span>
            <input
              className="w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-navy-light/50 focus:border-navy outline-none transition-colors"
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search by title or provider"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              className="text-sm rounded-lg border border-hairline bg-white px-3 py-2"
              value={type}
              onChange={(e) => setType(e.target.value)}
              aria-label="Filter by type"
            >
              <option value="">All types</option>
              {OPPORTUNITY_TYPE_OPTIONS.map((o) => (
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
        <div className="bg-white rounded-xl border border-hairline p-8 text-center mb-12">
          <p className="text-sm text-navy-light">
            No opportunities match that search. Try fewer filters or a different keyword.
          </p>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4 mb-12">
            {items.map((o) => (
              <OpportunityCard
                key={o.id}
                opportunity={o}
                saved={savedIds.has(o.id)}
                pending={pendingIds.has(o.id)}
                onToggleSave={() => toggleSave(o.id)}
              />
            ))}
          </div>

          {loading && <p className="text-sm text-navy-light mb-12">Loading&hellip;</p>}

          {!loading && hasMore && (
            <div className="mb-12 text-center">
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
            <p className="text-sm text-navy-light text-center mb-12 leading-relaxed">
              {filtersActive
                ? "That is every match for these filters. Try clearing one to see more."
                : "That is all the opportunities for now. Check back as new ones are added."}
            </p>
          )}
        </>
      )}

      <h2 id="saved" className="font-display text-lg font-semibold text-navy mb-5 scroll-mt-20">
        Saved ({saved.length})
      </h2>
      {saved.length === 0 ? (
        <div className="bg-white rounded-xl border border-hairline p-8 text-center">
          <p className="text-sm text-navy-light">Save opportunities above to keep track of them here.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {saved.map((s) => (
            <OpportunityCard
              key={s.opportunity.id}
              opportunity={s.opportunity}
              saved
              pending={pendingIds.has(s.opportunity.id)}
              onToggleSave={() => toggleSave(s.opportunity.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
