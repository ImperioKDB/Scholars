import { Skeleton } from "@/components/Skeleton";
import { OpportunityGridSkeleton } from "@/components/OpportunityGridSkeleton";

// Mirrors the real /opportunities layout: heading + subtext, the
// search/filter card, then a card grid -- same skeleton-parity convention
// as /discover and the rest of the app.
export default function OpportunitiesLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading opportunities">
      <span className="sr-only">Loading opportunities</span>
      <Skeleton className="h-8 w-56 mb-2" />
      <Skeleton className="h-4 w-72 mb-6" />
      <div className="bg-white rounded-xl border border-hairline p-4 mb-8">
        <Skeleton className="h-10 w-full rounded-lg mb-3" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-44 rounded-lg" />
          <Skeleton className="h-9 w-64 rounded-lg" />
        </div>
      </div>
      <OpportunityGridSkeleton />
    </div>
  );
}
