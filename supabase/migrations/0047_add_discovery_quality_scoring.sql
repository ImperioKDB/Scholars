-- Store explainable, deterministic quality checks before editorial review.
alter table public.scholarship_discovery_candidates
  add column if not exists quality_status text not null default 'unscored'
  check (quality_status in ('unscored', 'ready', 'needs_review', 'insufficient'));
alter table public.scholarship_discovery_candidates
  add column if not exists quality_score numeric(4,3) check (quality_score >= 0 and quality_score <= 1);
alter table public.scholarship_discovery_candidates
  add column if not exists quality_issues jsonb not null default '[]'::jsonb;
alter table public.scholarship_discovery_candidates
  add column if not exists quality_scored_at timestamptz;
create index if not exists idx_discovery_candidates_quality
  on public.scholarship_discovery_candidates (quality_status, quality_scored_at);
