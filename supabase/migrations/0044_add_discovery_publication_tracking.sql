-- Track the deliberate promotion of a reviewed discovery candidate into the public catalogue.
alter table public.scholarship_discovery_candidates
  drop constraint if exists scholarship_discovery_candidates_status_check;
alter table public.scholarship_discovery_candidates
  add constraint scholarship_discovery_candidates_status_check
  check (status in ('pending_review', 'approved', 'published', 'rejected', 'stale'));
alter table public.scholarship_discovery_candidates
  add column if not exists published_scholarship_id uuid references public.scholarships(id) on delete set null;
alter table public.scholarship_discovery_candidates
  add column if not exists published_at timestamptz;
create index if not exists idx_discovery_candidates_published
  on public.scholarship_discovery_candidates (published_scholarship_id)
  where published_scholarship_id is not null;
