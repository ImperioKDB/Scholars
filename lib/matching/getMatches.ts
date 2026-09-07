import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { rankScholarships, evaluateScholarship } from "./engine";
import { toMatchableProfile } from "./profileMapper";
import type { MatchableProfile, ScholarshipMatch, ScholarshipRule } from "./types";

const SCHOLARSHIP_COLUMNS =
  "id, title, provider_name, description, amount, deadline, opens_at, last_cycle_closed_at, application_url, how_to_apply, level, discipline, verified, awards_available, estimated_applicant_pool, competitiveness_tier, historical_acceptance_rate";

export async function getMatchesForCurrentUser(): Promise<{
  matches: ScholarshipMatch[];
  profileCompleteness: number;
  error: string | null;
}> {
  const { user, profile: profileRow } = await getCurrentUserAndProfile();
  if (!user) return { matches: [], profileCompleteness: 0, error: "not_authenticated" };
  if (!profileRow) return { matches: [], profileCompleteness: 0, error: "profile_not_found" };

  const profile: MatchableProfile = toMatchableProfile(profileRow);
  const supabase = createClient();

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

export async function getMatchForScholarship(scholarshipId: string): Promise<{
  match: ScholarshipMatch | null;
  profileCompleteness: number;
  error: string | null;
}> {
  const { user, profile: profileRow } = await getCurrentUserAndProfile();
  if (!user) return { match: null, profileCompleteness: 0, error: "not_authenticated" };
  if (!profileRow) return { match: null, profileCompleteness: 0, error: "profile_not_found" };

  const profile: MatchableProfile = toMatchableProfile(profileRow);
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
