import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createTimeoutFetch } from "@/lib/fetch";

// Anon-key client with no cookie/session handling at all -- for genuinely
// public, unauthenticated routes only. Currently used by app/s/[id]/page.tsx
// and its sibling opengraph-image.tsx.
//
// scholarships_select_verified grants the public role SELECT on verified rows.
// This client avoids depending on cookies in routes that don't need a user session.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: createTimeoutFetch() },
    }
  );
}
