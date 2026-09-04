import { Skeleton, SkeletonCard } from "@/components/Skeleton";

// Mirrors the real /discover layout: heading + subtext, the search/filter
// card, then a card grid -- same skeleton-parity convention as the other
// sections' loading.tsx files.
export default function DiscoverLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-56 mb-2" />
      <Skeleton className="h-4 w-72 mb-6" />
      <div className="bg-white rounded-xl border border-hairline p-4 mb-8">
        <Skeleton className="h-10 w-full rounded-lg mb-3" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-44 rounded-lg" />
          <Skeleton className="h-9 w-64 rounded-lg" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
