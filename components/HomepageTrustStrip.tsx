const TRUST_ITEMS = [
  {
    number: "01",
    label: "Free for students",
    detail: "Create a profile and explore matches without paying.",
  },
  {
    number: "02",
    label: "Verified listings",
    detail: "Each opportunity is checked before it goes live.",
  },
  {
    number: "03",
    label: "No paid placements",
    detail: "Providers cannot pay to improve a match or ranking.",
  },
  {
    number: "04",
    label: "Your decision stays yours",
    detail: "Scholars explains fit; the provider makes the final award decision.",
  },
] as const;

export function HomepageTrustStrip() {
  return (
    <section aria-labelledby="trust-heading" className="border-y border-hairline bg-navy-50">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 md:py-16">
        <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr] lg:gap-6">
          <div className="relative overflow-hidden rounded-2xl bg-navy p-6 text-white sm:p-8 lg:min-h-[22rem] lg:p-10">
            <div aria-hidden="true" className="absolute -right-10 -top-12 font-display text-[13rem] leading-none text-white/[0.05]">
              ?
            </div>
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-emerald-light">Good to know</p>
                <h2 id="trust-heading" className="mt-5 max-w-sm font-display text-3xl font-semibold leading-tight sm:text-4xl">
                  The useful stuff, before you start.
                </h2>
              </div>
              <div className="mt-12 flex items-end justify-between gap-6">
                <p className="max-w-xs text-sm leading-relaxed text-white/70">
                  A clearer way to find scholarships, without paid shortcuts or a wall of irrelevant results.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {TRUST_ITEMS.map((item) => (
              <article
                key={item.label}
                className="group rounded-2xl border border-hairline bg-white p-5 transition-transform duration-200 hover:-translate-y-1 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="font-mono text-xs tracking-widest text-emerald">{item.number}</span>
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald transition-transform duration-200 group-hover:scale-150" />
                </div>
                <h3 className="mt-8 font-display text-xl font-semibold text-navy">{item.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-light">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
