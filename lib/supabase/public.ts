import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// lib/supabase/public.ts
//
// Anon-key client with no cookie/session handling at all -- for genuinely
// public, unauthenticated routes only. Currently used by app/s/[id]/page.tsx
// and its sibling opengraph-image.tsx.
//
// scholarships_select_verified already grants the PUBLIC Postgres role
// SELECT on verified=true rows (confirmed directly against the live RLS
// policy), so this needs neither a user session nor the service-role key.
// Using this instead of lib/supabase/server.ts's createClient() also
// avoids depending on next/headers cookies() in a route that runs on the
// edge runtime and never needs a signed-in user's session to render.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
