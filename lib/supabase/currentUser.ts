// lib/supabase/currentUser.ts
//
// React's cache() memoizes a function's result per request within the
// Server Component render tree. Wrapping the auth + profile lookup here
// means a layout AND its page can both call getCurrentUserAndProfile()
// and Supabase only gets hit once, not once per caller.
//
// Route Handlers (app/api/**) are NOT part of the React render tree, so
// this cache() dedup doesn't extend to them -- calling this from a route
// handler just runs once per handler invocation, same as before.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { InstitutionType } from "@/lib/matching/types";

export type CurrentUserProfile = {
  full_name: string | null;
  is_admin: boolean;
  profile_completeness: number;
  discipline: string | null;
  gpa: number | null;
  nationality: string | null;
  gender: string | null;
  financial_need: boolean;
  date_of_birth: string | null;
  state_of_origin: string | null;
  lga_of_origin: string | null;
  year_of_study: number | null;
  institution_type: InstitutionType | null;
  jamb_score: number | null;
  waec_credit_count: number | null;
  has_english_maths_credit: boolean;
  disability_status: boolean;
  // Trigger-maintained cache of sum(xp_events.points) for this profile --
  // see migration add_xp_and_achievements / lib/xp/level.ts. Never write
  // to this column directly from application code.
  xp_total: number;
};

export const getCurrentUserAndProfile = cache(async () => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null as typeof user, profile: null as CurrentUserProfile | null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, is_admin, profile_completeness, discipline, gpa, nationality, gender, financial_need, date_of_birth, state_of_origin, lga_of_origin, year_of_study, institution_type, jamb_score, waec_credit_count, has_english_maths_credit, disability_status, xp_total"
    )
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile: profile as CurrentUserProfile | null };
});
