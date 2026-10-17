import { Skeleton } from "@/components/Skeleton";

function OpportunityCardSkeleton() {
  return (
    <div className="relative bg-white rounded-2xl border border-hairline p-5 flex flex-col gap-4 sm:flex-row shadow-card">
      <Skeleton className="w-[52px] h-[52px] rounded-full shrink-0" />
      <div className="min-w-0 flex-1 sm:pr-24">
        <Skeleton className="h-5 w-24 rounded-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-3 w-2/5" />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="space-y-2 mt-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      </div>
      <div className="absolute top-5 right-5 flex gap-3.5" aria-hidden="true">
        <Skeleton className="h-11 w-11 rounded-full" />
        <Skeleton className="h-11 w-11 rounded-full" />
      </div>
    </div>
  );
}

export function OpportunityGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="grid md:grid-cols-2 gap-4">
      {Array.from({ length: count }, (_, index) => (
        <OpportunityCardSkeleton key={index} />
      ))}
    </div>
  );
}
