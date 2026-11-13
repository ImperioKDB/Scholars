// Public Supabase configuration boundary.
//
// A single source of truth for determining whether the public Supabase
// client can be constructed. Centralising this check prevents inconsistent
// environment-variable reads across the application and makes it obvious
// where the configuration boundary lives.
//
// Only public, client-safe variable names are inspected here. Server-only
// credentials (SUPABASE_SERVICE_ROLE_KEY) are never checked in this module.

export function hasPublicSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
