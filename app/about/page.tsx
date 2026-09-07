import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { createClient } from "@/lib/supabase/server";
import { AboutPhotoUploader } from "@/components/AboutPhotoUploader";

export const metadata: Metadata = {
  title: "About | Scholars",
  description: "Why Scholars exists, how the matching works, and who builds it.",
};

// Fixed object name in the public 'site' bucket (migration 0013). Fixed on
// purpose: the page can build the public URL without a DB row, and Replace
// is just an upsert over the same path. Cache-busting uses the object's
// updated_at from the list() probe below.
const PORTRAIT_NAME = "about-portrait.jpg";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-lg font-semibold text-navy mb-3">{title}</h2>
      <div className="text-sm text-ink leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default async function AboutPage() {
  const { user, profile } = await getCurrentUserAndProfile();
  const isAdmin = Boolean(profile?.is_admin);
  const supabase = createClient();
  // Probe existence + updated_at. Pre-migration (bucket missing) this
  // errors and objs stays null, so the page degrades to the placeholder
  // instead of failing.
  const { data: objs } = await supabase.storage.from("site").list("", { limit: 50 });
  const portrait = (objs ?? []).find((o) => o.name === PORTRAIT_NAME);
  const portraitUrl = portrait
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site/${PORTRAIT_NAME}?v=${encodeURIComponent(portrait.updated_at ?? Date.now().toString())}`
    : null;
  return (
    <article>
      <h1 className="font-display text-3xl font-semibold text-navy mb-2">
        Finding a scholarship you can actually win should not be this hard.
      </h1>
      <p className="text-sm text-navy-light mb-8">
        Scholars puts one profile, honest matching, and every deadline in a single place.
      </p>
      <Section title="The problem">
        <p>
          Scholarship information in Nigeria lives scattered across provider websites, WhatsApp
          groups, and PDFs that expire. Eligibility rules differ from award to award and shift
          every cycle. Students retype the same details into every form, then miss the deadline
          anyway.
        </p>
      </Section>
      <Section title="What we do differently">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Matching by rules, not keywords.</strong> Every listing carries structured
            eligibility rules. Your profile is checked against them, and you see exactly which
            requirements you meet and which you are missing.
          </li>
          <li>
            <strong>Verified listings only.</strong> A scholarship goes live after a person checks
            it. Awards we cannot confirm are pulled or held, never guessed at.
          </li>
          <li>
            <strong>Scores that explain themselves.</strong> Each match shows its reasoning,
            including when an award is genuinely competitive. No black box and no invented numbers.
          </li>
          <li>
            <strong>Deadlines that chase you.</strong> Save a scholarship and we email you before it
            closes, then check in after it passes.
          </li>
        </ul>
      </Section>
      <Section title="Who builds this">
        <div className="grid md:grid-cols-[240px_1fr] gap-8 items-start">
          <div>
            {portraitUrl ? (
              <img
                src={portraitUrl}
                alt="The founder of Scholars"
                className="w-full aspect-square object-cover rounded-2xl border border-hairline shadow-card"
              />
            ) : (
              <div className="w-full aspect-square rounded-2xl border border-hairline bg-navy-50 flex items-center justify-center">
                <span className="font-display text-navy text-lg">Scholars</span>
              </div>
            )}
            {isAdmin && (
              <div className="mt-3">
                <AboutPhotoUploader currentUrl={portraitUrl} />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <p>
              Scholars is built and maintained in Nigeria, one verified listing at a time. The
              matching engine is deterministic on purpose: we would rather show you three awards
              you truly qualify for than thirty we cannot stand behind.
            </p>
            <p>
              The platform is free for students and stays free. There are no paid placements, and a
              match score cannot be bought.
            </p>
            <p className="text-xs text-navy-light">The founder, who still verifies listings by hand.</p>
          </div>
        </div>
      </Section>
      <Section title="Start here">
        <p>
          {user ? (
            <Link href="/dashboard" className="text-navy font-medium hover:underline">
              See your matches
            </Link>
          ) : (
            <>
              <Link href="/signup" className="text-navy font-medium hover:underline">
                Create your free profile
              </Link>{" "}
              and see your first matches in about five minutes.
            </>
          )}
        </p>
      </Section>
    </article>
  );
}
