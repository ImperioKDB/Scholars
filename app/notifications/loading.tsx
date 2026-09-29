import { Skeleton } from "@/components/Skeleton";

export default function NotificationsLoading() {
  return (
    <section aria-label="Loading notifications" aria-busy="true" className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-end justify-between gap-3">
        <div>
          <Skeleton className="h-3 w-32 mb-3" />
          <Skeleton className="h-8 w-44 mb-2" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-hairline bg-white">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="border-b border-hairline p-4 last:border-0">
            <div className="flex items-start gap-3">
              <Skeleton className="mt-1.5 h-2 w-2 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-2.5 w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
