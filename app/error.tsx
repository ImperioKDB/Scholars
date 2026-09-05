"use client";

// app/error.tsx
// Route-level error boundary (product audit P2: a crash in any client
// component used to white-screen the page with no recovery path). Next
// renders this in place of the route segment that threw; reset() re-renders
// that segment. It renders inside the root layout, so the app shell
// (sidebar, Ade) stays put and only the broken segment is replaced.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-6 py-16">
      <div className="bg-white rounded-2xl border border-hairline shadow-card p-8 max-w-md w-full text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-rose mb-4">Something broke</p>
        <h1 className="font-display text-2xl font-semibold text-navy mb-2">That&apos;s on us, not you</h1>
        <p className="text-sm text-navy-light mb-6">
          This part of the page hit an unexpected error. Trying again usually fixes it. Your saved
          scholarships and tracked applications are safe on the server either way.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-navy-light mb-6">Error reference: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
