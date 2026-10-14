const SCHOLARS_PRODUCTION_HOSTS = new Set([
  "scholars.com.ng",
  "www.scholars.com.ng",
]);

/**
 * Preserve the active Scholars host for installed PWAs. Other environments
 * continue using NEXT_PUBLIC_APP_URL when it is configured.
 */
export function getAuthRedirectOrigin(
  currentOrigin: string,
  configuredOrigin?: string
): string {
  try {
    const current = new URL(currentOrigin);
    if (SCHOLARS_PRODUCTION_HOSTS.has(current.hostname.toLowerCase())) {
      return `https://${current.hostname.toLowerCase()}`;
    }
  } catch {
    // Fall through to the configured origin or the original input.
  }

  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin;
    } catch {
      // Ignore malformed configuration and keep the current origin below.
    }
  }

  try {
    return new URL(currentOrigin).origin;
  } catch {
    return currentOrigin;
  }
}
