import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createTimeoutFetch } from "@/lib/fetch";

// Anon-key client with no cookie/session handling at all -- for genuinely
// public routes only. Catalog/share pages must query the curated
// *_public_preview_v1 views; this client is not for reading raw opportunity,
// scholarship, eligibility, application, or community tables. The corresponding
// grants are defined in 20261110203400_global_opportunity_access_hardening.sql.
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
