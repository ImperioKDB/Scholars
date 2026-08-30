import { Skeleton } from "@/components/Skeleton";

// Matches the real layout of app/scholarships/[id]/page.tsx: back link,
// then a single card with seal+title header, badge row, description,
// action row, and a requirements list -- so nothing jumps around once
// real content arrives.
export default function ScholarshipDetailLoading() {
  return (
    <div>
      <Skeleton className="h-4 w-28 mb-6" />

      <div className="bg-white rounded-2xl border border-hairline shadow-card p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <Skeleton className="w-16 h-16 rounded-full shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-7 w-3/4 mb-2" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>

        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6 mb-6" />

        <div className="flex gap-3 mb-8 pb-8 border-b border-hairline">
          <Skeleton className="h-10 w-40 rounded-seal" />
          <Skeleton className="h-10 w-24 rounded-seal" />
          <Skeleton className="h-10 w-36 rounded-seal" />
        </div>

        <Skeleton className="h-5 w-48 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
