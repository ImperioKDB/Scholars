"use client";

import Link from "next/link";
import { useState } from "react";
import { ScholarshipCard, type CardScholarship } from "@/components/ScholarshipCard";
import { StatusMessage } from "@/components/StatusMessage";
import { fetchWithTimeout } from "@/lib/fetch";
import { saveReturnScroll } from "@/lib/scrollRestore";
import type { ScholarshipMatch } from "@/lib/matching/types";

type FreshMatch = ScholarshipMatch & CardScholarship;

export function FreshMatchesClient({
  initialMatches,
  initialSavedIds,
  initialError,
}: {
  initialMatches: FreshMatch[];
  initialSavedIds: string[];
  initialError: string | null;
}) {
  const [savedIds, setSavedIds] = useState(() => new Set(initialSavedIds));
  const [pendingIds, setPendingIds] = useState(() => new Set<string>());

  async function toggleSave(scholarshipId: string) {
    const wasSaved = savedIds.has(scholarshipId);
    setSavedIds((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(scholarshipId);
      else next.add(scholarshipId);
      return next;
    });
    setPendingIds((current) => new Set(current).add(scholarshipId));
    try {
      const response = wasSaved
        ? await fetchWithTimeout(`/api/scholarships/save?scholarship_id=${scholarshipId}`, { method: "DELETE" })
        : await fetchWithTimeout("/api/scholarships/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scholarship_id: scholarshipId }),
          });
      if (!response.ok) throw new Error("save failed");
    } catch {
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.add(scholarshipId);
        else next.delete(scholarshipId);
        return next;
      });
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(scholarshipId);
        return next;
      });
    }
  }

  return (
    <div>
      <Link href="/dashboard" onClick={saveReturnScroll} className="text-sm font-medium text-navy-light hover:text-navy">
        &larr; Back to dashboard
      </Link>
      <div className="mt-6 mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-navy-light">Fresh matches</p>
        <h1 className="font-display text-3xl font-semibold text-navy mt-2">Scholarships to review</h1>
        <p className="text-sm text-navy-light mt-2 max-w-2xl">
          These are your latest scholarship matches. Open any card to see its deadline, eligibility requirements, description, and application details.
        </p>
      </div>
      {initialError && <StatusMessage tone="error" className="mb-6">{initialError}</StatusMessage>}
      {initialMatches.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-white p-8 text-center">
          <p className="text-sm text-navy-light">Complete a few profile fields to unlock fresh matches.</p>
          <Link href="/onboarding" className="inline-flex mt-4 text-sm font-medium text-navy hover:underline">Finish your profile &rarr;</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {initialMatches.map((match, index) => {
            const met = match.requirements.filter((requirement) => requirement.status === "met").length;
            const total = match.requirements.filter((requirement) => requirement.status !== "unverifiable").length;
            const missingLabels = match.requirements.filter((requirement) => requirement.status === "missing_data").map((requirement) => requirement.label);
            return (
              <div key={match.id} className="animate-card-in" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
                <ScholarshipCard
                  scholarship={match}
                  score={match.score}
                  metCount={met}
                  totalCount={total}
                  missingLabels={missingLabels}
                  saved={savedIds.has(match.id)}
                  pending={pendingIds.has(match.id)}
                  onToggleSave={() => toggleSave(match.id)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
