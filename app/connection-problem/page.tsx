import Link from "next/link";

export default function ConnectionProblemPage({
  searchParams,
}: {
  searchParams?: { next?: string | string[] };
}) {
  const candidate = Array.isArray(searchParams?.next) ? searchParams?.next[0] : searchParams?.next;
  const nextPath = candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/dashboard";

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-hairline bg-white p-7 text-center shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald">Connection check</p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-navy">We couldn’t verify your session yet</h1>
        <p className="mt-3 text-sm leading-6 text-navy-light">
          This can happen when the connection is weak. Your session has not been cleared. Check your internet, then try the page again.
        </p>
        <Link href={nextPath} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-seal bg-navy px-5 text-sm font-semibold text-white hover:bg-navy-light">
          Try again
        </Link>
      </section>
    </main>
  );
}
