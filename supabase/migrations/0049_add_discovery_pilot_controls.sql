-- A source must be both enabled and pilot_enabled before the collector can fetch it.
alter table public.discovery_sources
  add column if not exists pilot_enabled boolean not null default false;
comment on column public.discovery_sources.pilot_enabled is
  'Explicit opt-in for the live source pilot; does not enable scheduled crawling.';
create index if not exists idx_discovery_sources_pilot
  on public.discovery_sources (enabled, pilot_enabled, trust_tier);
