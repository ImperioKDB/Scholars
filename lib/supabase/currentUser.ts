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
  // Public URL of the student's uploaded profile photo (Supabase Storage,
  // migration 0010). Optional: the column only exists once 0010 is applied.
  // Null/absent = no photo, UI falls back to initials.
  avatar_url?: string | null;
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
  // DISPLAY FIX: select("*") instead of a fixed column list. A fixed list
  // hard-fails the WHOLE read if ANY listed column is missing from the live
  // schema (previously avatar_url, before migration 0010 was applied), which
  // nulled the entire profile and zeroed every downstream display
  // (completeness, matches, gaps, saved) even though the rows were intact.
  // "*" returns whatever columns exist, so the display works regardless of
  // which optional migrations have been applied. Same pattern the settings
  // page already uses successfully.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return { user, profile: profile as CurrentUserProfile | null };
});
