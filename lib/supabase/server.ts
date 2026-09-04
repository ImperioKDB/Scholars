import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side client using the anon key, respects the caller's session (RLS applies).
//
// AUTH SECURITY AUDIT (session cookie hardening): cookies written here are
// pinned to SameSite=lax and Secure in production. One honest architectural
// note: these cookies CANNOT be HttpOnly while the browser client
// (lib/supabase/client.ts, @supabase/ssr) needs to read the access token to
// make authenticated calls from the page. That is a Supabase SSR design
// constraint, not an oversight here. The compensating controls are:
//   - short-lived access tokens with server-side refresh (this client),
//   - refresh token rotation + session limits (Supabase dashboard, Auth >
//     Sessions),
//   - SameSite=lax against CSRF, Secure against network interception,
//   - RLS + server-side checks on every sensitive operation, so a stolen
//     browser token still only sees what RLS allows that user.
export function createClient() {
  const cookieStore = cookies();
  const hardened = (options: CookieOptions): CookieOptions => ({
    ...options,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" ? true : options.secure,
  });
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Can throw if this client is used during a Server Component
          // render (not a Route Handler / Server Action) -- Next.js
          // disallows setting cookies there. Supabase's auth client can
          // trigger this mid-render when it silently refreshes an expired
          // access token and tries to persist the new session. Safe to
          // swallow: middleware.ts already refreshes and persists the
          // session cookie on every request, so a failed write here just
          // means this render keeps using the pre-refresh cookie, and the
          // next request (through middleware) picks up the refreshed one.
          try {
            cookieStore.set({ name, value, ...hardened(options) });
          } catch {
            // no-op -- see comment above
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // no-op -- see comment above
          }
        },
      },
    }
  );
}

// Admin client using the service role key. NEVER import this from client components.
// Only use inside app/api/** route handlers.
export function createAdminClient() {
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
