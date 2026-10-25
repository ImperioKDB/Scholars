"use client";

import { useEffect, useState } from "react";
import { ScholarshipCommunity } from "@/components/ScholarshipCommunity";
import { createClient } from "@/lib/supabase/client";
import type { ScholarshipCommunity as ScholarshipCommunityData } from "@/lib/scholarship-community";

export function PublicScholarshipCommunity({ scholarshipId }: { scholarshipId: string }) {
  const [community, setCommunity] = useState<ScholarshipCommunityData | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function loadForSignedInUser() {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;

      const response = await fetch(`/api/scholarships/${scholarshipId}/community`, {
        cache: "no-store",
      });
      if (!response.ok || cancelled) return;

      const nextCommunity = (await response.json()) as ScholarshipCommunityData;
      if (!cancelled) setCommunity(nextCommunity);
    }

    void loadForSignedInUser();

    const { data: authState } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setCommunity(null);
        return;
      }
      void loadForSignedInUser();
    });

    return () => {
      cancelled = true;
      authState.subscription.unsubscribe();
    };
  }, [scholarshipId]);

  if (!community) return null;

  return (
    <ScholarshipCommunity
      scholarshipId={scholarshipId}
      initialDiscussions={community.discussions}
      prompts={community.prompts}
      socialProof={community.socialProof}
      canInteract
    />
  );
}
