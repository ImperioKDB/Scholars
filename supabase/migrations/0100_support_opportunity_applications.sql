-- Allow the shared applications tracker to represent opportunities as well as scholarships.
-- Existing scholarship applications remain unchanged.
alter table public.applications
  alter column scholarship_id drop not null;

alter table public.applications
  add constraint applications_one_listing_check
  check ((scholarship_id is not null)::integer + (opportunity_id is not null)::integer = 1);

create unique index if not exists applications_profile_opportunity_unique
  on public.applications (profile_id, opportunity_id)
  where opportunity_id is not null;
