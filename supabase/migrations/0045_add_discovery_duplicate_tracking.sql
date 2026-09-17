-- Flag likely duplicates before administrator review.
alter table public.scholarship_discovery_candidates
  add column if not exists duplicate_of uuid references public.scholarship_discovery_candidates(id) on delete set null;
alter table public.scholarship_discovery_candidates
  add column if not exists duplicate_score numeric(4,3) check (duplicate_score >= 0 and duplicate_score <= 1);
alter table public.scholarship_discovery_candidates
  add column if not exists duplicate_reason text;
create index if not exists idx_discovery_candidates_duplicate
  on public.scholarship_discovery_candidates (duplicate_of)
  where duplicate_of is not null;
