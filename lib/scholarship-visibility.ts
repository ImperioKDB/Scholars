import type { SupabaseClient } from "@supabase/supabase-js";
import { isClosedListing, todayUtcIso } from "@/lib/dates";

type VisibilityClient = SupabaseClient<any, any, any>;

/**
 * A saved or tracked scholarship is part of a student's personal workspace.
 * Keep it visible after its deadline so the student can review its history,
 * while preventing expired scholarships from re-entering general discovery.
 */
export async function getRetainedScholarshipIds(
  supabase: VisibilityClient,
  userId: string,
): Promise<Set<string>> {
  const [savedResult, applicationResult] = await Promise.all([
    supabase
      .from("saved_scholarships")
      .select("scholarship_id")
      .eq("profile_id", userId),
    supabase
      .from("applications")
      .select("scholarship_id")
      .eq("profile_id", userId),
  ]);

  return new Set([
    ...(savedResult.data ?? []).map((row: { scholarship_id: string }) => row.scholarship_id),
    ...(applicationResult.data ?? []).map((row: { scholarship_id: string }) => row.scholarship_id),
  ]);
}

/**
 * PostgREST OR fragment for general catalog queries. The retained IDs are
 * trusted UUIDs returned by Supabase, not request input.
 */
export function scholarshipVisibilityFilter(retainedIds: Set<string>): string {
  const active = `deadline.is.null,deadline.gte.${todayUtcIso()}`;
  if (retainedIds.size === 0) return active;
  return `${active},id.in.(${Array.from(retainedIds).join(",")})`;
}

export function isVisibleToUser(
  scholarship: { id: string; deadline?: string | null; last_cycle_closed_at?: string | null },
  retainedIds: Set<string>,
): boolean {
  return !isClosedListing(scholarship) || retainedIds.has(scholarship.id);
}
