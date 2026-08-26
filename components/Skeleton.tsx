// components/Skeleton.tsx
// Base pulsing placeholder + a couple of pre-composed shapes for the card
// grids used across Dashboard/Applications. Sized to roughly match their
// loaded counterparts so nothing jumps around once real content arrives.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-navy-50 ${className}`} />;
}

export function SkeletonStatTile() {
  return (
    <div className="bg-white rounded-xl border border-hairline p-4">
      <Skeleton className="h-7 w-10 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-hairline p-5 flex gap-4">
      <Skeleton className="w-[52px] h-[52px] rounded-full shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-3 w-1/2 mb-3" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
