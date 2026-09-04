import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Scholars",
  description: "What Scholars collects, why it collects it, and the choices you have.",
};

// Keep in sync with app/legal/terms/page.tsx.
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

export default function PrivacyPolicyPage() {
  return (
    <article>
      <h1 className="font-display text-3xl font-semibold text-navy mb-2">Privacy Policy</h1>
      <p className="text-sm text-navy-light mb-8">Last updated: {LAST_UPDATED}</p>

      <Section title="1. The short version">
        <p>
          Scholars matches you with scholarships you can realistically win. To do that well, we ask for
          real academic and personal details. We use them to run your matches, track your applications,
          and nudge you before deadlines. We do not sell your data, and we do not show your profile to
          other students. Two features involve public information by design, and they are explained in
          section 4: share links and referrals.
        </p>
      </Section>

      <Section title="2. What we collect">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Account details:</strong> your email address, your name, and (if you sign in with
            Google) the basic profile information Google shares with us.
          </li>
          <li>
            <strong>Your eligibility profile:</strong> date of birth, nationality, state and LGA of
            origin, course of study, institution, year of study, GPA, JAMB score, WAEC subjects and
            grades, financial need, disability status, career goals, and which application documents you
            have ready. Most of this is optional, but the less you fill in, the weaker your matches.
          </li>
          <li>
            <strong>Activity:</strong> scholarships you save, applications you track and their statuses,
            which application links you open, your XP, levels and achievements, and referrals you make.
          </li>
        </ul>
      </Section>

      <Section title="3. How we use it">
        <ul className="list-disc pl-5 space-y-2">
          <li>To compute eligibility matches and explain, requirement by requirement, why a score is what it is.</li>
          <li>To track your applications and follow up on them, including Ade&apos;s check-in prompts and deadline reminders.</li>
          <li>To generate draft application letters when you ask for them.</li>
          <li>To run the XP, level and achievement system and award referral bonuses.</li>
          <li>To send essential emails such as password resets and application reminders.</li>
          <li>To improve matching rules and fix problems.</li>
        </ul>
        <p>
          Some fields, like disability status, are sensitive. They are optional, they are never shown to
          other students, and they are used only to surface scholarships that are relevant to you.
        </p>
      </Section>

      <Section title="4. Share links and referrals (read this one)">
        <p>
          When you share a scholarship, we create a public page (under /s/) that anyone with the link
          can open without an account. That page shows the scholarship details. If you share while signed
          in, the page also credits you by name (and avatar, if you have one) and carries a referral
          tag, so you earn XP when someone you referred signs up. Your eligibility and profile details
          are never shown on that page. Only share if you are comfortable with your name appearing
          there.
        </p>
      </Section>

      <Section title="5. Third-party services">
        <p>
          We process data with a small set of infrastructure providers: Supabase for authentication and
          our database, Vercel for hosting, Google if you choose Google sign-in, and an AI service used
          only to generate application drafts when you request one. We do not sell your data to anyone,
          and we do not use advertising networks.
        </p>
      </Section>

      <Section title="6. Cookies and local storage">
        <ul className="list-disc pl-5 space-y-2">
          <li>Authentication cookies keep you signed in (handled by Supabase).</li>
          <li>
            If you arrive through someone&apos;s referral link, a short-lived cookie records that
            referral so they get credit when you sign up.
          </li>
          <li>
            Your in-progress onboarding answers are stored in your browser&apos;s local storage so a
            refresh does not wipe them out. That data stays on your device.
          </li>
        </ul>
      </Section>

      <Section title="7. Retention and deletion">
        <p>
          We keep your data while your account is active. To delete your account and the profile,
          application and activity data attached to it, email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-navy font-medium hover:underline">
            {CONTACT_EMAIL}
          </a>{" "}
          from the address you signed up with. Copies may persist in backups for a limited period before
          being overwritten.
        </p>
      </Section>

      <Section title="8. Security">
        <p>
          Data is encrypted in transit, database access keys are restricted to our server code, and admin
          tools are limited to a small number of accounts. No system is perfectly secure, though. If you
          find a vulnerability, please report it to us at {CONTACT_EMAIL}.
        </p>
      </Section>

      <Section title="9. Who this service is for">
        <p>
          Scholars is built for university-level students and is not directed at children under 16. We do
          not knowingly collect data from anyone under 16.
        </p>
      </Section>

      <Section title="10. Changes">
        <p>
          When this policy changes, we update this page and, for significant changes, post a notice
          inside the app.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          Questions about your data:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-navy font-medium hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>
    </article>
  );
}
