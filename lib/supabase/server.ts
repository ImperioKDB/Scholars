import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side client using the anon key, respects the caller's session (RLS applies).
export function createClient() {
  const cookieStore = cookies();

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
            cookieStore.set({ name, value, ...options });
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
