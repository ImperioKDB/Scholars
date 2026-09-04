import { Skeleton } from "@/components/Skeleton";

// Mirrors the real /settings layout: header + edit button, completeness
// card, then a run of definition-list cards. Same skeleton-parity
// convention as the other sections' loading.tsx files.
export default function SettingsLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-28 rounded-seal" />
      </div>
      <div className="bg-white rounded-xl border border-hairline p-5 mb-6">
        <Skeleton className="h-4 w-36 mb-3" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-hairline p-5 mb-6">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
