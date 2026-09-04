import Link from "next/link";
import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { createClient } from "@/lib/supabase/server";
import { INSTITUTION_TYPE_OPTIONS } from "@/lib/profile";
import { levelForXp } from "@/lib/xp/level";

// app/settings/page.tsx
// GET /settings
//
// AUDIT FIX (batch 5): the audit flagged that students had nowhere to
// see their own data outside the four-step onboarding flow. This is a
// read-only overview of the profile + WAEC results with one clear path
// back into onboarding to change anything. Deliberately NOT a second
// edit form -- two editing surfaces for the same data is how profiles
// drift out of sync.
type ProfileRow = {
  full_name: string | null;
  nationality: string | null;
  gender: string | null;
  discipline: string | null;
  gpa: number | null;
  financial_need: boolean;
  career_goals: string | null;
  date_of_birth: string | null;
  state_of_origin: string | null;
  lga_of_origin: string | null;
  year_of_study: number | null;
  institution_name: string | null;
  institution_type: string | null;
  jamb_score: number | null;
  waec_credit_count: number | null;
  has_english_maths_credit: boolean;
  disability_status: boolean;
  has_valid_id: boolean;
  has_transcript: boolean;
  has_recommendation_letter: boolean;
  has_personal_statement: boolean;
  has_lga_certificate: boolean;
  profile_completeness: number;
  xp_total: number;
};

type WaecRow = { subject: string; grade: string };

function formatDate(value: string | null): string {
  if (!value) return "";
  // profiles.date_of_birth is a Postgres date ("YYYY-MM-DD"); pin it to
  // UTC midnight so the displayed day can't shift with the viewer's
  // timezone.
  const iso = value.length === 10 ? `${value}T00:00:00Z` : value;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function institutionTypeLabel(value: string | null): string {
  if (!value) return "";
  return INSTITUTION_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-hairline last:border-0">
      <dt className="text-sm text-navy-light shrink-0">{label}</dt>
      <dd className={"text-sm text-right min-w-0 " + (value ? "text-ink font-medium" : "text-navy-light")}>
        {value || "Not set"}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-hairline p-5 mb-6">
      <h2 className="font-display text-lg font-semibold text-navy mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const { user } = await getCurrentUserAndProfile();
  if (!user) {
    return null;
  }

  const supabase = createClient();
  const [{ data: profile }, { data: waec }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("waec_results")
      .select("subject, grade")
      .eq("profile_id", user.id)
      .order("subject", { ascending: true }),
  ]);

  const p = profile as ProfileRow | null;
  const waecRows = (waec ?? []) as WaecRow[];

  if (!p) {
    return (
      <div className="bg-white rounded-xl border border-hairline p-8 text-center">
        <p className="text-sm text-navy-light mb-4">
          You haven&apos;t created a profile yet -- that&apos;s what powers your matches.
        </p>
        <Link
          href="/onboarding"
          className="inline-flex rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors"
        >
          Build your profile
        </Link>
      </div>
    );
  }

  const { level } = levelForXp(p.xp_total);
  const documents: { label: string; have: boolean }[] = [
    { label: "Valid means of identification", have: p.has_valid_id },
    { label: "Academic transcript / statement of results", have: p.has_transcript },
    { label: "Recommendation letter", have: p.has_recommendation_letter },
    { label: "Personal statement / letter of motivation", have: p.has_personal_statement },
    { label: "LGA / state of origin certificate", have: p.has_lga_certificate },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Your profile</h1>
          <p className="text-sm text-navy-light mt-1">
            Everything Scholars uses to match you. Change anything at any time.
          </p>
        </div>
        <Link
          href="/onboarding"
          className="rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors"
        >
          Edit profile
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-hairline p-5 mb-6">
        <div className="flex items-center justify-between mb-2 gap-3">
          <p className="text-sm font-medium text-ink">Profile completeness</p>
          <p className="text-sm font-mono text-navy">{p.profile_completeness}%</p>
        </div>
        <div className="h-2 rounded-full bg-hairline overflow-hidden">
          <div
            className={`h-full rounded-full ${p.profile_completeness === 100 ? "bg-emerald" : "bg-amber"}`}
            style={{ width: `${p.profile_completeness}%` }}
          />
        </div>
        <p className="text-xs text-navy-light mt-2">
          A fuller profile means more accurate match scores.
        </p>
      </div>

      <Section title="Personal">
        <dl>
          <Row label="Full name" value={p.full_name ?? ""} />
          <Row label="Date of birth" value={formatDate(p.date_of_birth)} />
          <Row label="Nationality" value={p.nationality ?? ""} />
          <Row label="Gender" value={p.gender ?? ""} />
          <Row label="State of origin" value={p.state_of_origin ?? ""} />
          <Row label="LGA of origin" value={p.lga_of_origin ?? ""} />
        </dl>
      </Section>

      <Section title="Academic">
        <dl>
          <Row label="Institution" value={p.institution_name ?? ""} />
          <Row label="Institution type" value={institutionTypeLabel(p.institution_type)} />
          <Row label="Field of study" value={p.discipline ?? ""} />
          <Row label="Year of study" value={p.year_of_study != null ? `${p.year_of_study} Level` : ""} />
          <Row label="GPA / CGPA" value={p.gpa != null ? String(p.gpa) : ""} />
        </dl>
      </Section>

      <Section title="Eligibility">
        <dl>
          <Row label="JAMB / UTME score" value={p.jamb_score != null ? String(p.jamb_score) : ""} />
          <Row
            label="WAEC credits"
            value={p.waec_credit_count != null ? String(p.waec_credit_count) : ""}
          />
          <Row label="English & Maths credit" value={p.has_english_maths_credit ? "Yes" : "No"} />
          <Row label="Financial need" value={p.financial_need ? "Yes" : "No"} />
          <Row label="Disability status" value={p.disability_status ? "Yes" : "No"} />
        </dl>
        <h3 className="text-sm font-medium text-ink mt-4 mb-2">WAEC subjects</h3>
        {waecRows.length === 0 ? (
          <p className="text-sm text-navy-light">No results added yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {waecRows.map((r) => (
              <li key={r.subject} className="text-xs font-medium bg-navy-50 text-navy px-2.5 py-1.5 rounded-full">
                {r.subject}: <span className="font-mono">{r.grade}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Documents ready to submit">
        <dl>
          {documents.map((d) => (
            <Row key={d.label} label={d.label} value={d.have ? "Ready" : "Not yet"} />
          ))}
        </dl>
      </Section>

      <Section title="Goals">
        {p.career_goals ? (
          <p className="text-sm text-ink leading-relaxed">{p.career_goals}</p>
        ) : (
          <p className="text-sm text-navy-light">Not set yet.</p>
        )}
      </Section>

      <Section title="Account">
        <dl>
          <Row label="Email" value={user.email ?? ""} />
          <Row label="Level" value={`Lv ${level} \u00b7 ${p.xp_total} XP`} />
        </dl>
        <p className="text-xs text-navy-light mt-3">
          Signed in with {user.app_metadata?.provider === "google" ? "Google" : "email"}. To reset your
          password or manage sign-in, use the options on the login page.
        </p>
      </Section>
    </div>
  );
}
