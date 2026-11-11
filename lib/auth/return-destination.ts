import { safeNextPath } from "../validate";

const ATTRIBUTION_PARAMS = new Set([
  "ref",
  "referral_source",
  "campaign_id",
  "ambassador_code",
  "utm_source",
  "utm_medium",
  "utm_campaign",
]);

/**
 * Builds a same-origin return path while keeping referral/campaign attribution
 * in its existing middleware cookies rather than nesting it in `next`.
 */
export function buildInternalReturnPath(
  pathname: string,
  params: Record<string, string | string[] | undefined> = {}
): string {
  const safePath = safeNextPath(pathname, "/");
  const url = new URL(safePath, "https://scholars.invalid");
  for (const [key, value] of Object.entries(params)) {
    if (ATTRIBUTION_PARAMS.has(key) || key === "next" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      url.searchParams.append(key, item);
    }
  }
  return `${url.pathname}${url.search}`;
}

export function buildOpportunityAuthPaths(returnPath: string): {
  signupPath: string;
  loginPath: string;
} {
  const safeReturnPath = safeNextPath(returnPath, "/dashboard");
  const onboardingPath = `/onboarding?next=${encodeURIComponent(safeReturnPath)}`;
  const encodedOnboardingPath = encodeURIComponent(onboardingPath);
  return {
    signupPath: `/signup?next=${encodedOnboardingPath}`,
    loginPath: `/login?next=${encodedOnboardingPath}`,
  };
}

/**
 * Resolve auth-page navigation for an existing session. A completed profile
 * skips a redundant onboarding round-trip; incomplete or unknown profiles keep
 * the onboarding path, preserving the existing behavior on lookup failure.
 */
export function resolveAuthenticatedReturnPath(
  requestedPath: string | null | undefined,
  profileCompleteness?: number | null
): string {
  const safePath = safeNextPath(requestedPath, "/dashboard");
  const url = new URL(safePath, "https://scholars.invalid");
  if (url.pathname !== "/onboarding" || !url.searchParams.has("next")) {
    return `${url.pathname}${url.search}`;
  }
  const returnPath = safeNextPath(url.searchParams.get("next"), "/dashboard");
  return profileCompleteness !== undefined && profileCompleteness !== null && profileCompleteness >= 100
    ? returnPath
    : `${url.pathname}${url.search}`;
}
