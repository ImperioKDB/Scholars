import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";

type ContributorProfile = {
  profile_id: string;
  display_name: string;
  institution_name: string | null;
  bio: string | null;
  community_role: "founder" | "contributor" | "student";
  contribution_count: number;
  avatar_url: string | null;
};

const ROLE_LABELS: Record<ContributorProfile["community_role"], string> = {
  founder: "Founder",
  contributor: "Contributor",
  student: "Student",
};

async function loadProfile(profileId: string): Promise<ContributorProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_contributor_profile", {
    p_profile_id: profileId,
  });
  if (error) {
    console.error("public_contributor_profile_read_failed", error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? (row as ContributorProfile) : null;
}

export async function generateMetadata({
  params,
}: {
  params: { profileId: string };
}): Promise<Metadata> {
  const profile = await loadProfile(params.profileId);
  if (!profile) return { title: "Contributor profile | Scholars" };
  return {
    title: `${profile.display_name} | Scholars community`,
    description: profile.bio || `${profile.display_name}'s public Scholars community profile.`,
    robots: { index: false, follow: false },
  };
}

export default async function ContributorProfilePage({
  params,
}: {
  params: { profileId: string };
}) {
  const profile = await loadProfile(params.profileId);
  if (!profile) notFound();

  return (
    <main className="min-h-[100dvh] bg-parchment px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-xl">
        <Link href="/discover" className="text-sm font-medium text-navy-light hover:text-navy">
          ← Back to Scholars
        </Link>
        <section className="mt-6 rounded-2xl border border-hairline bg-white p-5 shadow-card sm:p-7">
          <div className="flex items-start gap-4">
            <Avatar
              userId={profile.profile_id}
              fullName={profile.display_name}
              avatarUrl={profile.avatar_url}
              size="large"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald">Community contributor</p>
              <h1 className="mt-1 font-display text-2xl font-semibold text-navy">{profile.display_name}</h1>
              <p className="mt-1 text-sm text-navy-light">
                {ROLE_LABELS[profile.community_role]} · {profile.contribution_count} {profile.contribution_count === 1 ? "contribution" : "contributions"}
              </p>
            </div>
          </div>

          <div className="mt-7 space-y-5 border-t border-hairline pt-5">
            {profile.institution_name && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald">School</p>
                <p className="mt-1 text-sm leading-relaxed text-ink">{profile.institution_name}</p>
              </div>
            )}
            {profile.bio && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald">About</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{profile.bio}</p>
              </div>
            )}
            {!profile.institution_name && !profile.bio && (
              <p className="text-sm leading-relaxed text-navy-light">This contributor has not added school or bio details yet.</p>
            )}
          </div>

          <p className="mt-7 border-t border-hairline pt-4 text-xs leading-relaxed text-navy-light">
            This profile only shows information the contributor chose to share with the Scholars community. Contact details, academic results, and application information are not shown.
          </p>
        </section>
      </div>
    </main>
  );
}
