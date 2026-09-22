import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ProviderMonogram } from "@/components/ProviderMonogram";
import { HowItWorksRotator } from "@/components/HowItWorksRotator";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { Footer } from "@/components/Footer";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { createPublicClient } from "@/lib/supabase/public";
import { isCurrentlyOpen } from "@/lib/discovery";
import type { Metadata } from "next";

// PERF (batch 1): ISR. The live scholarship card hits Supabase at most
// once per 5 minutes instead of on every landing-page visit. The data is
// public and slow-moving (listings are verified by hand), so a short
// revalidation window costs nothing in freshness. This route is eligible
// for ISR because it reads through the cookie-free public client only.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Find scholarships you are eligible for",
  description:
    "Create one profile and discover verified scholarships for students in Nigeria, with deadlines and eligibility details in one place.",
};

// AUDIT FIX (batch 5): the hero card used to show three hardcoded sample
// matches, complete with invented match scores. A visitor has no profile
// yet, so any score on this page would be fabricated. The card now shows
// up to three REAL verified scholarships straight from the database (same
// public-client pattern as app/s/[id]/page.tsx), and says so honestly if
// nothing is live yet.
type LiveScholarship = {
  id: string;
  title: string;
  provider_name: string;
  amount: string | null;
  deadline: string | null;
  opens_at: string | null;
  last_cycle_closed_at: string | null;
  discipline: string | null;
  level: "undergrad" | "postgrad" | "both";
};

async function loadLiveScholarships(): Promise<LiveScholarship[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("scholarships")
    .select("id, title, provider_name, amount, deadline, opens_at, last_cycle_closed_at, discipline, level")
    .eq("verified", true)
    .in("level", ["undergrad", "both"])
    .order("deadline", { ascending: true })
    .limit(20);
  return (data ?? [])
    .filter((scholarship) => isCurrentlyOpen(scholarship))
    .slice(0, 4) as LiveScholarship[];
}

function levelLabel(level: LiveScholarship["level"]): string {
  if (level === "both") return "Undergrad & postgrad";
  if (level === "undergrad") return "Undergraduate";
  return "Postgraduate";
}

export default async function LandingPage() {
  const live = await loadLiveScholarships();
  return (
    <div className="min-h-screen overflow-y-auto scroll-smooth">
      <header className="border-b border-hairline bg-parchment/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-5 py-4 sm:px-6 sm:py-5 flex items-center justify-between">
          <Logo className="text-navy" />
          <nav className="hidden md:flex items-center gap-8 text-sm text-navy-light">
            <Link href="#how-it-works" className="hover:text-navy">How it works</Link>
            <Link href="/login" className="hover:text-navy">Log in</Link>
          </nav>
          <Link
            href="/signup"
            className="inline-flex min-h-[44px] items-center rounded-seal bg-navy text-white text-sm font-medium px-5 hover:bg-navy-light transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>
      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14 md:py-20">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,0.9fr)] lg:gap-16">
            <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald/20 bg-emerald-light px-3.5 py-1.5 text-xs font-medium text-emerald mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
              Eligibility-matched, not keyword-matched
            </span>
            <h1 className="font-display text-[2.75rem] leading-[1.08] sm:text-5xl md:text-6xl md:leading-[1.05] font-semibold text-navy text-balance">
              Apply to the scholarships you can actually win.
            </h1>
            <p className="mt-6 text-lg text-navy-light max-w-md">
              Built for students in Nigeria. Create one profile, see the scholarships
              you&apos;re actually eligible for, and stop wasting hours on ones you
              can&apos;t apply for.
            </p>
            <div className="mt-8">
              <Link
                href="/signup"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-seal bg-navy text-white font-medium px-6 hover:bg-navy-light transition-colors"
              >
                See your matches
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <p className="mt-3 flex items-center gap-1.5 text-sm text-navy-light">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald shrink-0">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Free to join, takes about 5 minutes
              </p>
            </div>
            </div>
            <div className="bg-white rounded-2xl shadow-card border border-hairline p-5 sm:p-6 lg:mt-2">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-navy-light">
                    Open now
                  </p>
                  <p className="text-sm text-navy-light mt-1">Verified opportunities accepting applications.</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-light px-2.5 py-1 text-xs font-medium text-emerald">
                  Verified listings
                </span>
              </div>
              {live.length === 0 ? (
                <p className="text-sm text-navy-light">
                  New scholarships are being researched and verified right now. Check back soon.
                </p>
              ) : (
                <ul className="space-y-4">
                  {live.map((s) => (
                    <li key={s.id} className="flex items-start gap-4 border-b border-hairline pb-4 last:border-0 last:pb-0">
                      <ProviderMonogram name={s.provider_name} size={48} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/scholarships/${s.id}`} className="font-medium text-ink text-sm leading-snug hover:text-navy hover:underline focus-visible:underline">
                          {s.title}
                        </Link>
                        <p className="text-xs text-navy-light mt-0.5">{s.provider_name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {s.amount && <span className="text-xs font-mono text-emerald">{s.amount}</span>}
                          <DeadlineBadge deadline={s.deadline} />
                          <span className="text-xs text-navy-light">{levelLabel(s.level)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/discover" className="mt-5 inline-flex min-h-[44px] items-center text-sm font-medium text-navy hover:underline">
                Browse all active scholarships <span aria-hidden="true" className="ml-1">&rarr;</span>
              </Link>
            </div>
          </div>
        </section>
        {/* How it works */}
        <section id="how-it-works" className="border-t border-hairline bg-white">
          <div className="mx-auto max-w-4xl px-6 py-14 md:py-16">
            <h2 className="font-display text-2xl font-semibold text-navy mb-10">
              How Scholars works
            </h2>
            <HowItWorksRotator />
          </div>
        </section>
        {/* Social proof: real consented student testimonials. Renders
            nothing until at least one row is consented and published. */}
        <TestimonialsSection />
      </main>
      <Footer />
    </div>
  );
}
