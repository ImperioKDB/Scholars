import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ProviderMonogram } from "@/components/ProviderMonogram";
import { HowItWorksRotator } from "@/components/HowItWorksRotator";
import { Footer } from "@/components/Footer";
import { createPublicClient } from "@/lib/supabase/public";
import { daysUntil, deadlineTone, formatDeadlineLabel } from "@/lib/dates";

// AUDIT FIX (batch 5): the hero card used to show three hardcoded sample
// matches, complete with invented match scores. A visitor has no profile
// yet, so any score on this page would be fabricated -- exactly the kind
// of made-up number the audit flagged as a trust liability. The card now
// shows up to three REAL verified scholarships straight from the database
// (same public-client pattern as app/s/[id]/page.tsx -- anon RLS already
// exposes verified rows), and says so honestly if nothing is live yet.
type LiveScholarship = {
  title: string;
  provider_name: string;
  amount: string | null;
  deadline: string | null;
  discipline: string | null;
  level: "undergrad" | "postgrad" | "both";
};

async function loadLiveScholarships(): Promise<LiveScholarship[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("scholarships")
    .select("title, provider_name, amount, deadline, discipline, level")
    .eq("verified", true)
    .in("level", ["undergrad", "both"])
    .order("deadline", { ascending: true })
    .limit(3);
  return (data ?? []) as LiveScholarship[];
}

const DEADLINE_TONE_CLASSES: Record<ReturnType<typeof deadlineTone>, string> = {
  closed: "bg-hairline text-navy-light",
  urgent: "bg-rose-light text-rose",
  soon: "bg-amber-light text-amber",
  later: "bg-navy-50 text-navy-light",
};

function levelLabel(level: LiveScholarship["level"]): string {
  if (level === "both") return "Undergrad & postgrad";
  if (level === "undergrad") return "Undergraduate";
  return "Postgraduate";
}

export default async function LandingPage() {
  const live = await loadLiveScholarships();

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
              Built for students in Nigeria. Create one profile, see the scholarships
              you&apos;re actually eligible for, and stop wasting hours on ones you
              can&apos;t apply for.
            </p>
            <div className="mt-8">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-seal bg-navy text-white font-medium px-6 py-3.5 hover:bg-navy-light transition-colors"
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

          <div className="bg-white rounded-2xl shadow-card border border-hairline p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-navy-light mb-4">
              Live on Scholars right now
            </p>
            {live.length === 0 ? (
              <p className="text-sm text-navy-light">
                New scholarships are being researched and verified right now. Check back soon.
              </p>
            ) : (
              <ul className="space-y-4">
                {live.map((s) => {
                  const days = daysUntil(s.deadline);
                  return (
                    <li key={s.title} className="flex items-center gap-4 pb-4 border-b border-hairline last:border-0 last:pb-0">
                      <ProviderMonogram name={s.provider_name} size={48} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink text-sm leading-snug">{s.title}</p>
                        <p className="text-xs text-navy-light mt-0.5">
                          {levelLabel(s.level)}
                          {s.discipline ? ` \u00b7 ${s.discipline}` : ""}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {s.amount && <span className="text-xs font-mono text-emerald">{s.amount}</span>}
                          {days !== null && (
                            <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full ${DEADLINE_TONE_CLASSES[deadlineTone(days)]}`}>
                              {formatDeadlineLabel(days)}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-hairline bg-white">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="font-display text-2xl font-semibold text-navy mb-10">
              How Scholars works
            </h2>
            <HowItWorksRotator />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
