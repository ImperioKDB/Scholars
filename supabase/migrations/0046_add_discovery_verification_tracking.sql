-- Record source reachability and freshness checks independently from editorial review.
alter table public.scholarship_discovery_candidates
  add column if not exists verification_status text not null default 'unverified'
  check (verification_status in ('unverified', 'verified', 'stale', 'unreachable', 'redirected'));
alter table public.scholarship_discovery_candidates
  add column if not exists verification_http_status integer;
alter table public.scholarship_discovery_candidates
  add column if not exists verification_final_url text;
alter table public.scholarship_discovery_candidates
  add column if not exists verification_notes text;
alter table public.scholarship_discovery_candidates
  add column if not exists last_verified_at timestamptz;
create index if not exists idx_discovery_candidates_verification
  on public.scholarship_discovery_candidates (verification_status, last_verified_at);
