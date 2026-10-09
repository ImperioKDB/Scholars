const SCHOLARS_AUTH_HOSTS = new Set(["scholars.com.ng", "www.scholars.com.ng"]);

/**
 * Return a cookie Domain only for the two production Scholars hostnames.
 * Preview deployments and local development remain host-only.
 */
export function getAuthCookieDomain(hostname: string): string | undefined {
  return SCHOLARS_AUTH_HOSTS.has(hostname.toLowerCase())
    ? ".scholars.com.ng"
    : undefined;
}
