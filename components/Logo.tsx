export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <path
          d="M13 1L24 7.5V18.5L13 25L2 18.5V7.5L13 1Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M13 1V25" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2 7.5L13 13L24 7.5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      <span className="font-display text-lg font-semibold tracking-tight">
        ScholarSync
      </span>
    </div>
  );
}
