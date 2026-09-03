import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { rankScholarships, evaluateScholarship } from "./engine";
import type { MatchableProfile, ScholarshipMatch, ScholarshipRule } from "./types";

// Server-only: uses the caller's session (RLS-scoped), not the service role key.
// Safe to call from Server Components and API routes; do not import from
// client components ("use client" files) -- it reads cookies().
//
// Profile lookup now goes through getCurrentUserAndProfile() (React
// cache()-wrapped) instead of its own query -- when this is called from
// a Server Component that's already called that helper (e.g. a layout),
// this profile fetch is free.
//
// SCHOLARSHIP_COLUMNS now includes opens_at (see migration:
// add_opens_at_and_trending_fn) alongside the competitiveness fields (see
// migration: add_competitiveness_fields). opens_at doesn't feed the engine
// -- it's read straight through to the UI for the "Open now" badge (see
// lib/discovery.ts). competitiveness_notes is deliberately NOT selected
// here -- admin-only sourcing detail, same exclusion as research_notes.
const SCHOLARSHIP_COLUMNS =
  "id, title, provider_name, description, amount, deadline, opens_at, application_url, how_to_apply, level, discipline, verified, awards_available, estimated_applicant_pool, competitiveness_tier, historical_acceptance_rate";

export async function getMatchesForCurrentUser(): Promise<{
  matches: ScholarshipMatch[];
  profileCompleteness: number;
  error: string | null;
}> {
  const { user, profile: profileRow } = await getCurrentUserAndProfile();

  if (!user) {
    return { matches: [], profileCompleteness: 0, error: "not_authenticated" };
  }

  // No row yet is the normal state for a user who hasn't completed
  // onboarding -- not a server error.
  if (!profileRow) {
    return { matches: [], profileCompleteness: 0, error: "profile_not_found" };
  }

  const profile: MatchableProfile = {
    discipline: profileRow.discipline,
    gpa: profileRow.gpa,
    nationality: profileRow.nationality,
    gender: profileRow.gender,
    financial_need: profileRow.financial_need,
    date_of_birth: profileRow.date_of_birth,
    state_of_origin: profileRow.state_of_origin,
    lga_of_origin: profileRow.lga_of_origin,
    year_of_study: profileRow.year_of_study,
    institution_type: profileRow.institution_type,
    jamb_score: profileRow.jamb_score,
    waec_credit_count: profileRow.waec_credit_count,
    has_english_maths_credit: profileRow.has_english_maths_credit,
    disability_status: profileRow.disability_status,
    profile_completeness: profileRow.profile_completeness,
  };

  const supabase = createClient();

  // Platform is undergrad-only: exclude postgrad-only listings entirely
  // rather than scoring and gating them per-profile.
  const [{ data: scholarships, error: scholarshipsError }, { data: rules, error: rulesError }] =
    await Promise.all([
      supabase
        .from("scholarships")
        .select(SCHOLARSHIP_COLUMNS)
        .eq("verified", true)
        .in("level", ["undergrad", "both"]),
      supabase.from("scholarship_rules").select("id, scholarship_id, field, operator, value"),
    ]);

  if (scholarshipsError || rulesError || !scholarships) {
    return { matches: [], profileCompleteness: profile.profile_completeness, error: "fetch_failed" };
  }

  const rulesByScholarship = new Map<string, ScholarshipRule[]>();
  for (const rule of rules ?? []) {
    const list = rulesByScholarship.get(rule.scholarship_id) ?? [];
    list.push(rule as ScholarshipRule);
    rulesByScholarship.set(rule.scholarship_id, list);
  }

  const matches = rankScholarships(profile, scholarships, rulesByScholarship);

  return { matches, profileCompleteness: profile.profile_completeness, error: null };
}

// Single-scholarship version of the above, used by the scholarship detail
// page and its API route. Reuses evaluateScholarship directly (same engine
// getMatchesForCurrentUser uses) so a scholarship's score on its own detail
// page always matches its score on the dashboard -- no second scoring path
// to drift out of sync.
//
// Deliberately does NOT require the scholarship to be in the current
// match list -- a student can land here from a saved scholarship whose
// profile fields changed since it was saved, or a direct link.
export async function getMatchForScholarship(scholarshipId: string): Promise<{
  match: ScholarshipMatch | null;
  profileCompleteness: number;
  error: string | null;
}> {
  const { user, profile: profileRow } = await getCurrentUserAndProfile();

  if (!user) {
    return { match: null, profileCompleteness: 0, error: "not_authenticated" };
  }

  if (!profileRow) {
    return { match: null, profileCompleteness: 0, error: "profile_not_found" };
  }

  const profile: MatchableProfile = {
    discipline: profileRow.discipline,
    gpa: profileRow.gpa,
    nationality: profileRow.nationality,
    gender: profileRow.gender,
    financial_need: profileRow.financial_need,
    date_of_birth: profileRow.date_of_birth,
    state_of_origin: profileRow.state_of_origin,
    lga_of_origin: profileRow.lga_of_origin,
    year_of_study: profileRow.year_of_study,
    institution_type: profileRow.institution_type,
    jamb_score: profileRow.jamb_score,
    waec_credit_count: profileRow.waec_credit_count,
    has_english_maths_credit: profileRow.has_english_maths_credit,
    disability_status: profileRow.disability_status,
    profile_completeness: profileRow.profile_completeness,
  };

  const supabase = createClient();

  const [{ data: scholarship, error: scholarshipError }, { data: rules, error: rulesError }] =
    await Promise.all([
      supabase
        .from("scholarships")
        .select(SCHOLARSHIP_COLUMNS)
        .eq("id", scholarshipId)
        .eq("verified", true)
        .in("level", ["undergrad", "both"])
        .maybeSingle(),
      supabase
        .from("scholarship_rules")
        .select("id, scholarship_id, field, operator, value")
        .eq("scholarship_id", scholarshipId),
    ]);

  if (scholarshipError || rulesError) {
    return { match: null, profileCompleteness: profile.profile_completeness, error: "fetch_failed" };
  }

  if (!scholarship) {
    return { match: null, profileCompleteness: profile.profile_completeness, error: "not_found" };
  }

  const match = evaluateScholarship(profile, scholarship, (rules ?? []) as ScholarshipRule[]);

  return { match, profileCompleteness: profile.profile_completeness, error: null };
}
