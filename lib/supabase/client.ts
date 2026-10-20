import { createBrowserClient } from "@supabase/ssr";
import { getAuthCookieDomain } from "@/lib/auth/cookie-domain";
import { createTimeoutFetch } from "@/lib/fetch";

export function createClient() {
  const cookieDomain =
    typeof window === "undefined"
      ? undefined
      : getAuthCookieDomain(window.location.hostname);
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: cookieDomain ? { domain: cookieDomain } : {},
      global: { fetch: createTimeoutFetch() },
    }
  );
}
