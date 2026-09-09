import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { Logo } from "@/components/Logo";
import { BackLink } from "@/components/BackLink";

// app/testimonials/[id]/page.tsx
// Public full-quote detail page for one approved, consented testimonial.
// The landing rotator clamps quotes to three lines as a teaser; this page
// is where the whole statement lives, in the display serif, with the
// student's photo and attribution. Same approved+consent RLS filter as the
// rotator, so nothing unpublished is reachable by guessing an id.
// ISR-cached (5 min) because testimonials change rarely.
export const revalidate = 300;

type Testimonial = {
  id: string;
  full_name: string;
  role: string;
  quote: string;
  photo_url: string | null;
};

async function load(id: string): Promise<Testimonial | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("testimonials")
    .select("id, full_name, role, quote, photo_url")
    .eq("id", id)
    .eq("approved", true)
    .eq("consent", true)
    .maybeSingle();
  return (data as Testimonial) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await load(id);
  if (!t) return { title: "Testimonial not found | Scholars" };
  return {
    title: `${t.full_name} on Scholars`,
    description: t.quote.slice(0, 160),
  };
}

export default async function TestimonialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await load(id);
  if (!t) notFound();
  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-hairline bg-white">
        <div className="mx-auto max-w-2xl px-6 py-5">
          <Link href="/" aria-label="Scholars home">
            <Logo className="text-navy" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-12">
        <BackLink href="/" label="Back to home" />
        <article className="bg-white rounded-2xl border border-hairline shadow-card p-6 md:p-8">
          <div className="flex items-center gap-4 mb-6">
            {t.photo_url ? (
              <img
                src={t.photo_url}
                alt={t.full_name}
                className="w-20 h-20 rounded-2xl object-cover shrink-0"
              />
            ) : (
              <span
                className="w-20 h-20 rounded-2xl bg-navy-50 text-navy flex items-center justify-center font-display font-semibold text-2xl shrink-0"
                aria-hidden="true"
              >
                {t.full_name.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold text-navy">{t.full_name}</p>
              <p className="text-sm text-navy-light">{t.role}</p>
            </div>
          </div>
          <blockquote className="font-display text-lg md:text-xl leading-relaxed text-ink">
            {"“"}
            {t.quote}
            {"”"}
          </blockquote>
        </article>
        <p className="text-xs text-navy-light mt-4 leading-relaxed">
          Published with the student&apos;s permission.{" "}
          <Link href="/legal/privacy" className="text-navy font-medium hover:underline">
            Privacy policy
          </Link>
        </p>
      </main>
    </div>
  );
}
