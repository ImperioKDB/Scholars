import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Scholars",
  description: "The rules of using Scholars, in plain language.",
};

// Keep in sync with app/legal/privacy/page.tsx.
// TODO before launch: replace with the real support inbox.
const CONTACT_EMAIL = "support@scholars.ng";
const LAST_UPDATED = "2025";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-lg font-semibold text-navy mb-3">{title}</h2>
      <div className="text-sm text-ink leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function TermsOfServicePage() {
  return (
    <article>
      <h1 className="font-display text-3xl font-semibold text-navy mb-2">Terms of Service</h1>
      <p className="text-sm text-navy-light mb-8">Last updated: {LAST_UPDATED}</p>

      <Section title="1. What Scholars is (and is not)">
        <p>
          Scholars is a matching and tracking tool. It compares your academic profile against researched
          scholarship requirements, shows you where you stand, and helps you keep your applications
          organized. Scholars is not a scholarship provider and not an application portal: when you apply,
          you apply on the provider&apos;s own site, under the provider&apos;s own rules.
        </p>
      </Section>

      <Section title="2. Your account">
        <p>
          You are responsible for keeping your sign-in details safe and for everything that happens under
          your account. Fill in your profile honestly: matches are only as good as the data behind them,
          and inaccurate information can waste your time and the time of scholarship committees.
        </p>
      </Section>

      <Section title="3. Matches are estimates, not promises">
        <p>
          Match scores are computed from your profile and from requirements our team researches from
          public sources. We show our reasoning requirement by requirement because requirements change,
          providers interpret them differently, and new conditions appear. A high score never guarantees a
          shortlist or an award, and a low score does not mean you cannot apply. Always confirm current
          requirements and deadlines with the provider before you commit to anything.
        </p>
      </Section>

      <Section title="4. Listings and the verified badge">
        <p>
          Scholarships are listed from public information. A verified badge means our team checked the
          listing at a point in time; it is not an endorsement by the provider, and Scholars is not
          affiliated with providers unless we explicitly say so. If you spot a listing that is wrong,
          stale, or fraudulent, report it to {CONTACT_EMAIL} and we will act on it.
        </p>
      </Section>

      <Section title="5. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>use Scholars for anything unlawful;</li>
          <li>scrape, bulk-download, or mirror the listings or the matching engine;</li>
          <li>create fake accounts or abuse the referral system;</li>
          <li>impersonate another person or institution; or</li>
          <li>interfere with the service, its infrastructure, or other people&apos;s use of it.</li>
        </ul>
      </Section>

      <Section title="6. XP, levels and achievements">
        <p>
          XP, levels, achievements and referral bonuses are engagement features. They have no monetary
          value, cannot be redeemed, sold or transferred, and we can change how they are earned at any
          time.
        </p>
      </Section>

      <Section title="7. AI-generated drafts">
        <p>
          Draft letters generated on the platform are a starting point, not a finished application.
          Review every claim, figure and sentence before you submit anything. We make no promises about
          outcomes from using a draft.
        </p>
      </Section>

      <Section title="8. Sharing and referrals">
        <p>
          Share pages are public. Share only if you are comfortable with your name appearing on them, do
          not spam referral links, and do not make misleading claims about scholarships when you share.
        </p>
      </Section>

      <Section title="9. Your content and our intellectual property">
        <p>
          You keep ownership of what you submit (career goals, letters, profile answers) and grant us the
          right to store and process it to provide the service. The service itself, including the
          branding, the matching presentation and Ade, belongs to us and may not be reused without
          permission.
        </p>
      </Section>

      <Section title="10. Availability, changes and termination">
        <p>
          We work to keep Scholars available, but the service is provided without uptime guarantees. We
          may change features, suspend the service, or close accounts that break these terms. You can
          stop using Scholars and request deletion of your account at any time (see the Privacy Policy).
        </p>
      </Section>

      <Section title="11. Warranties and liability">
        <p>
          To the maximum extent permitted by law, Scholars is provided as-is, without warranties of any
          kind, and our liability for claims connected to the service is limited to the greatest extent
          the law allows. Nothing in these terms excludes liability that cannot be excluded under
          applicable law.
        </p>
      </Section>

      <Section title="12. Governing law">
        <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>
      </Section>

      <Section title="13. Contact">
        <p>
          Questions about these terms:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-navy font-medium hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>
    </article>
  );
}
