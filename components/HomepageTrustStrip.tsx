const TRUST_ITEMS = [
  {
    label: "Free for students",
    detail: "Create a profile and explore matches without paying.",
  },
  {
    label: "Verified listings",
    detail: "Each opportunity is checked before it goes live.",
  },
  {
    label: "No paid placements",
    detail: "A provider cannot pay to improve a match or ranking.",
  },
  {
    label: "Your decision stays yours",
    detail: "Scholars explains fit; the provider makes the final award decision.",
  },
];

export function HomepageTrustStrip() {
  return (
    <section aria-labelledby="trust-heading" className="border-y border-hairline bg-navy-50">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 md:py-10">
        <div className="mb-6 max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-widest text-emerald mb-2">Good to know</p>
          <h2 id="trust-heading" className="font-display text-2xl font-semibold text-navy">
            Clear matches. No paid shortcuts.
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map((item) => (
            <div key={item.label}>
              <h3 className="text-sm font-semibold text-navy">{item.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-navy-light">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
