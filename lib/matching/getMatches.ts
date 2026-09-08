import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { rankScholarships, evaluateScholarship } from "./engine";
import { toMatchableProfile } from "./profileMapper";
import { getCachedMatches, setCachedMatches } from "./matchCache";
import type { MatchableProfile, ScholarshipMatch, ScholarshipRule, ScholarshipRow } from "./types";

// PERF (batch 1): list evaluation drops `description`. Cards and the
// dashboard never render it, and pulling a large text column for every
// scholarship on every dashboard load was pure payload weight. The detail
// page fetches its own copy via SCHOLARSHIP_DETAIL_COLUMNS.
const SCHOLARSHIP_LIST_COLUMNS =
  "id, title, provider_name, amount, deadline, opens_at, last_cycle_closed_at, application_url, how_to_apply, level, discipline, verified, awards_available, estimated_applicant_pool, competitiveness_tier, historical_acceptance_rate";
const SCHOLARSHIP_DETAIL_COLUMNS = SCHOLARSHIP_LIST_COLUMNS + ", description";

type CachedMatchPayload = {
  matches: ScholarshipMatch[];
  profileCompleteness: number;
};

export async function getMatchesForCurrentUser(): Promise<{
  matches: ScholarshipMatch[];
  profileCompleteness: number;
  error: string | null;
}> {
  const { user, profile: profileRow } = await getCurrentUserAndProfile();
  if (!user) return { matches: [], profileCompleteness: 0, error: "not_authenticated" };
  if (!profileRow) return { matches: [], profileCompleteness: 0, error: "profile_not_found" };

  // PERF (batch 1): warm-cache path. Returns the exact same payload
  // shape, so callers (dashboard, POST /api/scholarships/match, gaps)
  // are unchanged. TTL bounds staleness at 10 minutes; profile and WAEC
  // writes invalidate explicitly. Defensive shape check: a corrupted
  // cache entry falls through to a fresh evaluation instead of crashing.
  const cached = await getCachedMatches(user.id);
  if (cached && typeof cached === "object" && Array.isArray((cached as CachedMatchPayload).matches)) {
    const payload = cached as CachedMatchPayload;
    return {
      matches: payload.matches,
      profileCompleteness: payload.profileCompleteness,
      error: null,
    };
  }

  const profile: MatchableProfile = toMatchableProfile(profileRow);
  const supabase = createClient();

  const [{ data: scholarships, error: scholarshipsError }, { data: rules, error: rulesError }] =
    await Promise.all([
      supabase
        .from("scholarships")
        .select(SCHOLARSHIP_LIST_COLUMNS)
        .eq("verified", true)
        .in("level", ["undergrad", "both"]),
      supabase.from("scholarship_rules").select("id, scholarship_id, field, operator, value"),
    ]);

  if (scholarshipsError || rulesError || !scholarships) {
    return { matches: [], profileCompleteness: profile.profile_completeness, error: "fetch_failed" };
  }

  const rows = ((scholarships ?? []) as unknown as ScholarshipRow[]).map((s) => ({
    ...s,
    description: null as string | null,
  }));

  const rulesByScholarship = new Map<string, ScholarshipRule[]>();
  for (const rule of rules ?? []) {
    const list = rulesByScholarship.get(rule.scholarship_id) ?? [];
    list.push(rule as ScholarshipRule);
    rulesByScholarship.set(rule.scholarship_id, list);
  }

  const matches = rankScholarships(profile, rows, rulesByScholarship);

  await setCachedMatches(user.id, {
    matches,
    profileCompleteness: profile.profile_completeness,
  });

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
        .select(SCHOLARSHIP_DETAIL_COLUMNS)
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
