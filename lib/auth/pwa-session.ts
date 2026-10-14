export type SessionCookie = Readonly<{ name: string; value: string }>;

// Supabase SSR stores the session in one cookie or numbered chunks. Do not
// migrate unrelated sb-* cookies such as PKCE code verifiers or app cookies.
const SUPABASE_SESSION_COOKIE = /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i;

export function getSupabaseSessionCookieNames(
  ...cookieLists: ReadonlyArray<ReadonlyArray<SessionCookie>>
): string[] {
  const names = new Set<string>();
  for (const cookieList of cookieLists) {
    for (const cookie of cookieList) {
      if (SUPABASE_SESSION_COOKIE.test(cookie.name)) names.add(cookie.name);
    }
  }
  return [...names];
}

export function mergeSupabaseSessionCookies(
  ...cookieLists: ReadonlyArray<ReadonlyArray<SessionCookie>>
): SessionCookie[] {
  const merged = new Map<string, SessionCookie>();
  for (const cookieList of cookieLists) {
    for (const cookie of cookieList) {
      if (SUPABASE_SESSION_COOKIE.test(cookie.name)) {
        // Later sources (middleware refreshes) take precedence over the
        // incoming request's previous cookie value.
        merged.set(cookie.name, { name: cookie.name, value: cookie.value });
      }
    }
  }
  return [...merged.values()];
}
