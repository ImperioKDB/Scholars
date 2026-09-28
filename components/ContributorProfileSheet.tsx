"use client";

import { useEffect } from "react";
import Link from "next/link";
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

export function ContributorProfileSheet({
  profile,
  loading,
  onClose,
}: {
  profile: ContributorProfile | null;
  loading: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!profile && !loading) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [loading, onClose, profile]);

  if (!profile && !loading) return null;

  return (
    <div className="fixed inset-0 z-[80]" role="presentation">
      <button
        type="button"
        aria-label="Close contributor profile"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-navy/30"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="contributor-profile-title"
        className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-b-0 border-hairline bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 shadow-card sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {loading ? (
              <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-navy-50" aria-hidden="true" />
            ) : (
              <Avatar
                userId={profile?.display_name ?? "contributor"}
                fullName={profile?.display_name ?? "Contributor"}
                avatarUrl={profile?.avatar_url}
                size="medium"
              />
            )}
            <div className="min-w-0">
              <p id="contributor-profile-title" className="font-display text-lg font-semibold text-navy">
                {loading ? "Loading profile…" : profile?.display_name}
              </p>
              {!loading && profile && (
                <p className="mt-0.5 text-xs text-navy-light">
                  {ROLE_LABELS[profile.community_role]} · {profile.contribution_count} {profile.contribution_count === 1 ? "contribution" : "contributions"}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close contributor profile"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-navy-light hover:bg-navy-50 hover:text-navy"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        {loading ? (
          <div className="mt-5 space-y-2" aria-label="Loading contributor details">
            <div className="h-4 w-2/3 animate-pulse rounded bg-navy-50" />
            <div className="h-4 w-full animate-pulse rounded bg-navy-50" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-navy-50" />
          </div>
        ) : profile ? (
          <div className="mt-5 space-y-4">
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
            <Link
              href={`/community/contributors/${profile.profile_id}`}
              className="inline-flex w-full items-center justify-center rounded-seal bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-light"
            >
              View full profile
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export type { ContributorProfile };
