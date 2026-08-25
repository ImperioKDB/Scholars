import Link from "next/link";
import { Logo } from "@/components/Logo";
import { MatchSeal } from "@/components/MatchSeal";
import { HowItWorksRotator } from "@/components/HowItWorksRotator";
import { Footer } from "@/components/Footer";

const SAMPLE_MATCHES = [
  { name: "MTN Foundation Science & Technology Scholarship", tag: "Undergraduate · STEM", amount: "₦300,000 + Mentorship", score: 94 },
  { name: "Dangote Postgraduate Scholarship", tag: "Postgraduate · Business", amount: "₦750,000", score: 88 },
  { name: "Chevron Scholarship for African Women", tag: "Undergraduate · STEM", amount: "₦350,000", score: 72 },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-hairline">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <Logo className="text-navy" />
          <nav className="hidden md:flex items-center gap-8 text-sm text-navy-light">
            <Link href="#how-it-works" className="hover:text-navy">How it works</Link>
            <Link href="/login" className="hover:text-navy">Log in</Link>
          </nav>
          <Link
            href="/signup"
            className="rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-16 pb-20 grid md:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald/20 bg-emerald-light px-3.5 py-1.5 text-xs font-medium text-emerald mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
              Eligibility-matched, not keyword-matched
            </span>
            <h1 className="font-display text-[2.75rem] leading-[1.08] md:text-6xl md:leading-[1.05] font-semibold text-navy text-balance">
              Apply to the scholarships you can actually win.
            </h1>
            <p className="mt-6 text-lg text-navy-light max-w-md">
              Create one profile. Discover the scholarships you&apos;re actually
              eligible for. Stop wasting hours on opportunities you can&apos;t
              apply for.
            </p>
            <div className="mt-8">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-seal bg-navy text-white font-medium px-6 py-3.5 hover:bg-navy-light transition-colors"
              >
                Build your profile
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <p className="mt-3 flex items-center gap-1.5 text-sm text-navy-light">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald shrink-0">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Free to join — takes about 5 minutes
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-hairline p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-navy-light mb-4">
              Recommended for you
            </p>
            <ul className="space-y-4">
              {SAMPLE_MATCHES.map((m) => (
                <li key={m.name} className="flex items-center gap-4 pb-4 border-b border-hairline last:border-0 last:pb-0">
                  <MatchSeal score={m.score} size={48} />
                  <div className="min-w-0">
                    <p className="font-medium text-ink text-sm leading-snug">{m.name}</p>
                    <p className="text-xs text-navy-light mt-0.5">{m.tag}</p>
                    <p className="text-xs font-mono text-emerald mt-1">{m.amount}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-hairline bg-white">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="font-display text-2xl font-semibold text-navy mb-10">
              How ScholarSync works
            </h2>
            <HowItWorksRotator />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
