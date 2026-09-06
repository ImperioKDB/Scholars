-- Adds last_cycle_closed_at to scholarships. Used to distinguish
-- "no restriction, open by default" from "known closed, reopen date
-- unknown" for well-known cyclical scholarships.
--
-- APPLIED LIVE via Supabase SQL editor. Reference only.
alter table public.scholarships
add column if not exists last_cycle_closed_at date;

comment on column public.scholarships.last_cycle_closed_at is
'Last confirmed date this scholarship''s application window closed. Set only for cyclical programs where the reopen date is unknown. Distinguishes "open by default" from "known closed, unknown reopen".';
