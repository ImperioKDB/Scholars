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
// Phase 1: WhatsApp consent capture (migration 0019). Optional so the
// type stays valid even before the migration is applied to a given DB.
whatsapp_opt_in?: boolean;
whatsapp_number?: string | null;
onboarding_step?: number;
onboarding_last_activity_at?: string | null;
};
export const getCurrentUserAndProfile = cache(async () => {
const supabase = createClient();
const {
data: { user },
} = await supabase.auth.getUser();
if (!user) {
return { user: null as typeof user, profile: null as CurrentUserProfile | null };
}
// Keep the hot authenticated path narrow. The previous select("*") pulled
// every profile column into every dashboard/layout render, including fields
// used only by settings and onboarding. These are the columns consumed by the
// shell and matching engine; optional columns remain nullable in the type.
const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select(
    "full_name, is_admin, profile_completeness, discipline, gpa, nationality, gender, financial_need, date_of_birth, state_of_origin, lga_of_origin, year_of_study, institution_type, jamb_score, waec_credit_count, has_english_maths_credit, disability_status, avatar_url, xp_total, whatsapp_opt_in, whatsapp_number, onboarding_step, onboarding_last_activity_at"
  )
  .eq("id", user.id)
  .maybeSingle();
// Preserve the old schema-drift resilience for deployments where an optional
// migration has not landed yet. This fallback is cold-path only; healthy
// production renders use the narrow projection above.
if (profileError) {
  const { data: fallbackProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return { user, profile: fallbackProfile as CurrentUserProfile | null };
}
return { user, profile: profile as CurrentUserProfile | null };
});
