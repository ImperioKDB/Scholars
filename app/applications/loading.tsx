import { Skeleton, SkeletonCard, SkeletonDonut } from "@/components/Skeleton";

// Shape now matches app/applications/page.tsx: page heading + subtext,
// a StatusDonut-shaped card (see SkeletonDonut), a "Tracked applications"
// heading, then a card grid. Previously this rendered a circular-avatar
// block with four lines of text -- a leftover copy of the dashboard's
// profile-completion skeleton that never matched what Applications
// actually shows, causing a visible layout jump on load.
export default function ApplicationsLoading() {
  return (
    <div className="min-h-screen bg-parchment">
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-60 border-r border-hairline bg-white">
        <div className="px-5 py-5 border-b border-hairline">
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="px-4 py-4 border-b border-hairline">
          <Skeleton className="h-9 w-9 rounded-full mb-2.5" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
        <div className="px-3 py-4 space-y-2">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </aside>

      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-hairline flex items-center px-4 gap-3">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-5 w-24" />
      </header>

      <main className="md:pl-60">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-10 md:pt-10">
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-56 mb-6" />

          <div className="bg-white rounded-xl border border-hairline p-5 mb-8">
            <SkeletonDonut />
          </div>

          <Skeleton className="h-6 w-44 mb-5" />
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
