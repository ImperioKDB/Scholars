import { createClient } from "@/lib/supabase/server";
import { rankScholarships } from "./engine";
import type { MatchableProfile, ScholarshipMatch, ScholarshipRule } from "./types";

// Server-only: uses the caller's session (RLS-scoped), not the service role key.
// Safe to call from Server Components and API routes; do not import from
// client components ("use client" files) -- it reads cookies().
export async function getMatchesForCurrentUser(): Promise<{
  matches: ScholarshipMatch[];
  profileCompleteness: number;
  error: string | null;
}> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { matches: [], profileCompleteness: 0, error: "not_authenticated" };
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select(
      "discipline, gpa, nationality, gender, financial_need, date_of_birth, state_of_origin, lga_of_origin, year_of_study, institution_type, jamb_score, waec_credit_count, has_english_maths_credit, disability_status, profile_completeness"
    )
    .eq("id", user.id)
    .maybeSingle();

  // No row yet is the normal state for a user who hasn't completed
  // onboarding -- not a server error.
  if (profileError) {
    return { matches: [], profileCompleteness: 0, error: "fetch_failed" };
  }
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

  // Platform is undergrad-only: exclude postgrad-only listings entirely
  // rather than scoring and gating them per-profile.
  const [{ data: scholarships, error: scholarshipsError }, { data: rules, error: rulesError }] =
    await Promise.all([
      supabase
        .from("scholarships")
        .select("id, title, provider_name, description, amount, deadline, application_url, level, discipline, verified")
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
