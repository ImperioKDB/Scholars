import Link from "next/link";

// Branded 404. Next renders this for any URL that matches no route (and
// whenever notFound() is called, e.g. a dead scholarship share link), so
// visitors never see the framework's default error screen. Rendered
// inside the root layout; AdeProvider self-gates off unknown paths, so
// no mascot shows here.
export default function NotFound() {
  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl border border-hairline shadow-card p-8 max-w-md w-full text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-emerald mb-4">404</p>
        <h1 className="font-display text-2xl font-semibold text-navy mb-2">This page flew off</h1>
        <p className="text-sm text-navy-light mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has moved. Your matches, saves, and
          tracked applications are all still where you left them.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/dashboard"
            className="rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors"
          >
            Back to dashboard
          </Link>
          <Link
            href="/"
            className="rounded-seal border border-hairline text-navy-light text-sm font-medium px-5 py-2.5 hover:border-navy/40 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
