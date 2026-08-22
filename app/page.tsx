import Link from "next/link";
import { Logo } from "@/components/Logo";
import { MatchSeal } from "@/components/MatchSeal";

const SAMPLE_MATCHES = [
  { name: "MTN Foundation Science & Technology Scholarship", tag: "Undergraduate · STEM", amount: "₦300,000 + Mentorship", score: 94 },
  { name: "Dangote Postgraduate Scholarship", tag: "Postgraduate · Business", amount: "₦750,000", score: 88 },
  { name: "Chevron Scholarship for African Women", tag: "Undergraduate · STEM", amount: "₦350,000", score: 72 },
];

const STEPS = [
  { name: "Build your profile", detail: "Academic level, discipline, GPA, and the details providers actually screen for." },
  { name: "See your matches", detail: "A ranked list, scored against real eligibility rules — not a keyword search." },
  { name: "Keep every deadline", detail: "Save the ones you want, and get reminded before they close." },
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
            <p className="font-mono text-xs tracking-widest uppercase text-emerald mb-5">
              Eligibility-matched, not keyword-matched
            </p>
            <h1 className="font-display text-[2.75rem] leading-[1.08] md:text-6xl md:leading-[1.05] font-semibold text-navy text-balance">
              Apply to the scholarships you can actually win.
            </h1>
            <p className="mt-6 text-lg text-navy-light max-w-md">
              One profile. A ranked list scored against each scholarship&apos;s real
              eligibility rules. No more digging through PDFs to find out you
              didn&apos;t qualify.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Link
                href="/signup"
                className="rounded-seal bg-navy text-white font-medium px-6 py-3.5 hover:bg-navy-light transition-colors"
              >
                Build your profile
              </Link>
              <span className="text-sm text-navy-light font-mono">Free · 5 minutes</span>
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
            <div className="grid md:grid-cols-3 gap-10">
              {STEPS.map((step, i) => (
                <div key={step.name} className="border-t-2 border-navy pt-4">
                  <p className="font-mono text-xs text-emerald mb-2">0{i + 1}</p>
                  <h3 className="font-display text-lg font-semibold text-navy mb-2">
                    {step.name}
                  </h3>
                  <p className="text-sm text-navy-light leading-relaxed">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-6 py-10 flex items-center justify-between text-sm text-navy-light">
          <Logo className="text-navy" />
          <p>&copy; {new Date().getFullYear()} ScholarSync</p>
        </div>
      </footer>
    </div>
  );
}
