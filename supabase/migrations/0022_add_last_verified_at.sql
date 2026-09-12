-- Track when a scholarship was last verified by an admin. Powers the
-- "Verified on <date>" label in the admin list and lets the Health page
-- distinguish "verified last year, probably stale" from "verified
-- yesterday, still fresh". Null on unverified rows by design: an
-- unverified draft has no verification date to show.
--
-- Stamped by app/api/admin/scholarships/[id]/route.ts whenever a PATCH
-- flips verified to true. Un-verifying (verified = false) clears the
-- date, so re-verifying a stale listing produces a fresh timestamp.
--
-- Idempotent: safe to re-run.
alter table public.scholarships
  add column if not exists last_verified_at timestamptz;

comment on column public.scholarships.last_verified_at is
  'Last time an admin set verified=true on this row. Null when unverified. Cleared when un-verified.';
