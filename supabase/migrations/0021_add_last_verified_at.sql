-- Trust surface: record when a listing was last confirmed by a human.
-- Powers the public "Last checked <date>" line on share pages and the
-- in-app detail page, so "verified" is a dated claim rather than a
-- timeless badge. Written by the admin scholarship routes whenever a
-- listing is created verified, or re-saved while verified.
--
-- No backfill on purpose: for rows verified before this column existed we
-- leave it NULL and the UI says "Verified by the Scholars team" without a
-- date, rather than inventing or proxying a date from updated_at (which
-- could reflect an unrelated edit). Honesty over completeness.
--
-- Apply in the Supabase SQL editor, then this file becomes the reference
-- record per project convention. Idempotent: safe to re-run.
alter table public.scholarships
add column if not exists last_verified_at timestamptz;
comment on column public.scholarships.last_verified_at is
'When an admin last confirmed this listing as live and accurate. Null = verified before this column existed, or never verified.';
