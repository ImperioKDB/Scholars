// components/StatusMessage.tsx
//
// Shared feedback surface for async and form states. Errors are deliberately
// more than red text: they get a calm tinted panel, a visible status marker,
// and an assertive announcement so students can understand what happened and
// what to do next without hunting around the page.
export function StatusMessage({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "success" | "error" | "neutral";
  className?: string;
}) {
  if (!children) return null;

  const isError = tone === "error";
  const isSuccess = tone === "success";
  const toneClass = isError
    ? "border-rose-light bg-rose-light text-rose"
    : isSuccess
      ? "border-emerald-light bg-emerald-light text-emerald"
      : "border-hairline bg-paper text-navy-light";
  const markerClass = isError
    ? "bg-rose text-white"
    : isSuccess
      ? "bg-emerald text-white"
      : "bg-navy-50 text-navy";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6 ${toneClass} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${markerClass}`}
      >
        {isError ? "!" : isSuccess ? "✓" : "i"}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
