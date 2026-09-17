import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { rankScholarships, evaluateScholarship } from "./engine";
import { toMatchableProfile } from "./profileMapper";
import { getCachedCatalog, getCachedMatches, setCachedCatalog, setCachedMatches } from "./matchCache";
import { predictNextCycle, type CycleEvent } from "../cycles";
import { logError } from "@/lib/logging";
import type { MatchableProfile, ScholarshipMatch, ScholarshipRule, ScholarshipRow } from "./types";

// PERF (batch 1): list evaluation drops `description`. Cards and the
// dashboard never render it, and pulling a large text column for every
// scholarship on every dashboard load was pure payload weight. The detail
// page fetches its own copy via SCHOLARSHIP_DETAIL_COLUMNS.
const SCHOLARSHIP_LIST_COLUMNS =
  "id, slug, title, provider_name, amount, deadline, opens_at, last_cycle_closed_at, application_url, how_to_apply, level, discipline, verified, awards_available, estimated_applicant_pool, competitiveness_tier, historical_acceptance_rate";
const SCHOLARSHIP_DETAIL_COLUMNS = SCHOLARSHIP_LIST_COLUMNS + ", description, last_verified_at";

type CachedMatchPayload = {
  matches: ScholarshipMatch[];
  profileCompleteness: number;
};
type CachedCatalogPayload = {
  scholarships: ScholarshipRow[];
  rules: ScholarshipRule[];
};

// Phase 2: attach a predicted next cycle window to each match from
// cycle_events history. One extra query for the whole list (in-clause on
// scholarship_id), grouped client-side. Fail-open: if the cycle_events
// table is missing (migration not applied yet) or the read errors, matches
// return exactly as before with cycle left undefined.
async function attachCyclePredictions(
  supabase: ReturnType<typeof createClient>,
  matches: ScholarshipMatch[]
): Promise<ScholarshipMatch[]> {
  const ids = matches.map((m) => m.id);
  if (ids.length === 0) return matches;
  const { data, error } = await supabase
    .from("cycle_events")
    .select("scholarship_id, kind, event_date")
    .in("scholarship_id", ids);
  if (error || !data) return matches;
  const byId = new Map<string, CycleEvent[]>();
  for (const row of data as { scholarship_id: string; kind: CycleEvent["kind"]; event_date: string }[]) {
    const list = byId.get(row.scholarship_id) ?? [];
    list.push({ kind: row.kind, event_date: row.event_date });
    byId.set(row.scholarship_id, list);
  }
  return matches.map((m) => ({
    ...m,
    cycle: byId.has(m.id) ? predictNextCycle(byId.get(m.id)!) : null,
  }));
}

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
  const cachedCatalog = await getCachedCatalog();
  const catalog =
    cachedCatalog &&
    typeof cachedCatalog === "object" &&
    Array.isArray((cachedCatalog as CachedCatalogPayload).scholarships) &&
    Array.isArray((cachedCatalog as CachedCatalogPayload).rules)
      ? (cachedCatalog as CachedCatalogPayload)
      : null;
  let scholarships: ScholarshipRow[] | null = catalog?.scholarships ?? null;
  let rules: ScholarshipRule[] | null = catalog?.rules ?? null;
  let scholarshipsError: { code?: string; details?: string; hint?: string } | null = null;
  let rulesError: { code?: string; details?: string; hint?: string } | null = null;
  if (!catalog) {
    const [scholarshipsResult, rulesResult] = await Promise.all([
      supabase
        .from("scholarships")
        .select(SCHOLARSHIP_LIST_COLUMNS)
        .eq("verified", true)
        .in("level", ["undergrad", "both"]),
      supabase.from("scholarship_rules").select("id, scholarship_id, field, operator, value"),
    ]);
    scholarships = (scholarshipsResult.data ?? null) as unknown as ScholarshipRow[] | null;
    rules = (rulesResult.data ?? null) as unknown as ScholarshipRule[] | null;
    scholarshipsError = scholarshipsResult.error;
    rulesError = rulesResult.error;
    if (!scholarshipsError && !rulesError && scholarships && rules) {
      void setCachedCatalog({ scholarships, rules });
    }
  }

  // HARDENING: previously fetch_failed swallowed the underlying PostgREST
  // error, so schema drift (missing column, missing table) surfaced as a
  // blank matches list with no diagnostic anywhere. Now we log the real
  // error to Vercel Logs with enough context to pinpoint the missing
  // column, while still returning the same client-facing shape.
  if (scholarshipsError || rulesError || !scholarships) {
    if (scholarshipsError) {
      logError("matching/getMatches", "scholarships_fetch_failed", {
        code: scholarshipsError.code,
        details: scholarshipsError.details,
        hint: scholarshipsError.hint,
      }, scholarshipsError);
    }
    if (rulesError) {
      logError("matching/getMatches", "rules_fetch_failed", {
        code: rulesError.code,
        details: rulesError.details,
        hint: rulesError.hint,
      }, rulesError);
    }
    return { matches: [], profileCompleteness: profile.profile_completeness, error: "fetch_failed" };
  }

  const rows = (scholarships ?? []).map((s) => ({
    ...s,
    description: null as string | null,
  }));
  const rulesByScholarship = new Map<string, ScholarshipRule[]>();
  for (const rule of rules ?? []) {
    const list = rulesByScholarship.get(rule.scholarship_id) ?? [];
    list.push(rule as ScholarshipRule);
    rulesByScholarship.set(rule.scholarship_id, list);
  }

  const ranked = rankScholarships(profile, rows, rulesByScholarship);
  const matches = await attachCyclePredictions(supabase, ranked);

  void setCachedMatches(user.id, {
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
  const [
    { data: scholarship, error: scholarshipError },
    { data: rules, error: rulesError },
    { data: cycleRows },
  ] = await Promise.all([
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
    supabase
      .from("cycle_events")
      .select("kind, event_date")
      .eq("scholarship_id", scholarshipId),
  ]);

  // HARDENING: same diagnostic logging as above. A missing column on
  // scholarships or scholarship_rules now names itself in Vercel Logs.
  if (scholarshipError || rulesError) {
    if (scholarshipError) {
      logError("matching/getMatchForScholarship", "scholarship_fetch_failed", {
        id: scholarshipId,
        code: scholarshipError.code,
        details: scholarshipError.details,
      }, scholarshipError);
    }
    if (rulesError) {
      logError("matching/getMatchForScholarship", "rules_fetch_failed", {
        id: scholarshipId,
        code: rulesError.code,
      }, rulesError);
    }
    return { match: null, profileCompleteness: profile.profile_completeness, error: "fetch_failed" };
  }
  if (!scholarship) {
    return { match: null, profileCompleteness: profile.profile_completeness, error: "not_found" };
  }

  const evaluated = evaluateScholarship(profile, scholarship as unknown as ScholarshipRow, (rules ?? []) as ScholarshipRule[]);
  const match: ScholarshipMatch = {
    ...evaluated,
    cycle: cycleRows ? predictNextCycle(cycleRows as CycleEvent[]) : null,
  };
  return { match, profileCompleteness: profile.profile_completeness, error: null };
}
