-- PostgREST upserts require table-level INSERT and UPDATE privileges,
-- in addition to the RLS policies and column grants established earlier.
-- Keep the privileged admin flag unwritable by authenticated users.
grant insert, update on table public.profiles to authenticated;
revoke insert (is_admin), update (is_admin)
  on table public.profiles from authenticated;
