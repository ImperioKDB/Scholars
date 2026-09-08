"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { createClient } from "@/lib/supabase/server";
import { INSTITUTION_TYPE_OPTIONS } from "@/lib/profile";
import { levelForXp } from "@/lib/xp/level";
import { AvatarUploader } from "@/components/AvatarUploader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

// app/settings/page.tsx
// GET /settings
//
// Read-only overview of the profile + WAEC results with one clear path
// back into onboarding to change anything, plus the profile photo upload
// (the one self-serve edit surface, since a photo has no onboarding home).
//
// NEW (user feedback batch): a "Delete your account" section at the
// bottom. Privacy concern raised by a tester: "will the developer see my
// personal details?" The honest answer is yes (admins can read profile
// rows via Supabase dashboard), so students need a self-serve off-ramp
// instead of being forced to email support. DELETE /api/profile wipes the
// profile row, which cascades via FK ON DELETE CASCADE to saved,
// applications, WAEC results, notifications, achievements, XP events,
// and feedback rows. The auth email stays in Supabase auth.users (that
// requires the service role to delete) -- the confirmation dialog is
// honest about that and points to support for full erasure.
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
  avatar_url: string | null;
  profile_completeness: number;
  xp_total: number;
};

type WaecRow = { subject: string; grade: string };

function formatDate(value: string | null): string {
  if (!value) return "";
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

export default function SettingsPage({
  profile,
  waecRows,
  userEmail,
}: {
  profile: ProfileRow | null;
  waecRows: WaecRow[];
  userEmail: string;
}) {
  const router = useRouter();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.error ?? "Couldn't delete your account. Please try again.");
        setDeleting(false);
        setDeleteConfirmOpen(false);
        return;
      }
      // Profile is gone -- sign out on the client and bounce to the
      // landing page. Supabase's signOut clears the session cookie.
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
      router.replace("/");
      router.refresh();
    } catch {
      setDeleteError("Network error -- check your connection and try again.");
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }

  if (!profile) {
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

  const { level } = levelForXp(profile.xp_total);
  const documents: { label: string; have: boolean }[] = [
    { label: "Valid means of identification", have: profile.has_valid_id },
    { label: "Academic transcript / statement of results", have: profile.has_transcript },
    { label: "Recommendation letter", have: profile.has_recommendation_letter },
    { label: "Personal statement / letter of motivation", have: profile.has_personal_statement },
    { label: "LGA / state of origin certificate", have: profile.has_lga_certificate },
  ];

  return (
    <div>
      {deleteConfirmOpen && (
        <ConfirmDialog
          message="Delete your account? This removes your profile, saved scholarships, tracked applications, WAEC results, achievements, and all activity from Scholars. This cannot be undone. Your sign-in email will remain in our auth system until you email support.scholarsteam@gmail.com asking for full removal."
          onConfirm={handleDeleteAccount}
          onClose={() => !deleting && setDeleteConfirmOpen(false)}
          confirmLabel={deleting ? "Deleting…" : "Delete my account"}
          cancelLabel="Keep my account"
          tone="rose"
        />
      )}
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
          <p className="text-sm font-mono text-navy">{profile.profile_completeness}%</p>
        </div>
        <div className="h-2 rounded-full bg-hairline overflow-hidden">
          <div
            className={`h-full rounded-full ${profile.profile_completeness === 100 ? "bg-emerald" : "bg-amber"}`}
            style={{ width: `${profile.profile_completeness}%` }}
          />
        </div>
        <p className="text-xs text-navy-light mt-2">
          A fuller profile means more accurate match scores.
        </p>
      </div>
      <Section title="Profile photo">
        <AvatarUploader initialUrl={profile.avatar_url} />
        <p className="text-xs text-navy-light mt-3">
          Shown next to your name instead of the initials avatar. JPG, PNG, or WebP, up to 2MB.
        </p>
      </Section>
      <Section title="Personal">
        <dl>
          <Row label="Full name" value={profile.full_name ?? ""} />
          <Row label="Date of birth" value={formatDate(profile.date_of_birth)} />
          <Row label="Nationality" value={profile.nationality ?? ""} />
          <Row label="Gender" value={profile.gender ?? ""} />
          <Row label="State of origin" value={profile.state_of_origin ?? ""} />
          <Row label="LGA of origin" value={profile.lga_of_origin ?? ""} />
        </dl>
      </Section>
      <Section title="Academic">
        <dl>
          <Row label="Institution" value={profile.institution_name ?? ""} />
          <Row label="Institution type" value={institutionTypeLabel(profile.institution_type)} />
          <Row label="Field of study" value={profile.discipline ?? ""} />
          <Row label="Year of study" value={profile.year_of_study != null ? `${profile.year_of_study} Level` : ""} />
          <Row label="GPA / CGPA" value={profile.gpa != null ? String(profile.gpa) : ""} />
        </dl>
      </Section>
      <Section title="Eligibility">
        <dl>
          <Row label="JAMB / UTME score" value={profile.jamb_score != null ? String(profile.jamb_score) : ""} />
          <Row
            label="WAEC credits"
            value={profile.waec_credit_count != null ? String(profile.waec_credit_count) : ""}
          />
          <Row label="English & Maths credit" value={profile.has_english_maths_credit ? "Yes" : "No"} />
          <Row label="Financial need" value={profile.financial_need ? "Yes" : "No"} />
          <Row label="Disability status" value={profile.disability_status ? "Yes" : "No"} />
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
        {profile.career_goals ? (
          <p className="text-sm text-ink leading-relaxed">{profile.career_goals}</p>
        ) : (
          <p className="text-sm text-navy-light">Not set yet.</p>
        )}
      </Section>
      <Section title="Account">
        <dl>
          <Row label="Email" value={userEmail} />
          <Row label="Level" value={`Lv ${level} · ${profile.xp_total} XP`} />
        </dl>
        <p className="text-xs text-navy-light mt-3">
          Signed in with email. To reset your password or manage sign-in, use the options on the login page.
        </p>
      </Section>
      {/* DELETE ACCOUNT (user feedback batch): self-serve erasure, same
          ConfirmDialog pattern the admin panel already uses for
          destructive actions. Honest copy about what stays (the auth
          email) and how to fully erase it (email support). */}
      <Section title="Delete your account">
        <p className="text-sm text-navy-light leading-relaxed mb-4">
          This removes your profile, saved scholarships, tracked applications, WAEC results,
          achievements, and all activity from Scholars. Your sign-in email stays in our auth
          system; email <span className="font-medium text-ink">support.scholarsteam@gmail.com</span>{" "}
          from that address if you want it fully erased too.
        </p>
        {deleteError && (
          <p role="alert" className="text-sm text-rose mb-3">
            {deleteError}
          </p>
        )}
        <button
          type="button"
          onClick={() => setDeleteConfirmOpen(true)}
          disabled={deleting}
          className="rounded-seal border border-rose/40 text-rose text-sm font-medium px-5 py-2.5 hover:bg-rose-light transition-colors disabled:opacity-60"
        >
          Delete my account
        </button>
      </Section>
    </div>
  );
}
