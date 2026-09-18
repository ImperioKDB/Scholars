-- Advisory AI review only. This never authorizes publication by itself.
alter table public.scholarship_discovery_candidates
  add column if not exists eligibility_review_status text not null default 'unreviewed'
  check (eligibility_review_status in ('unreviewed', 'reviewed', 'unclear', 'error'));
alter table public.scholarship_discovery_candidates
  add column if not exists eligibility_verdict text
  check (eligibility_verdict is null or eligibility_verdict in ('eligible', 'likely_eligible', 'unclear', 'not_eligible'));
alter table public.scholarship_discovery_candidates
  add column if not exists eligibility_confidence numeric(4,3)
  check (eligibility_confidence is null or (eligibility_confidence >= 0 and eligibility_confidence <= 1));
alter table public.scholarship_discovery_candidates
  add column if not exists eligibility_report jsonb;
alter table public.scholarship_discovery_candidates
  add column if not exists eligibility_reviewed_at timestamptz;
alter table public.scholarship_discovery_candidates
  add column if not exists eligibility_review_error text;
create index if not exists idx_discovery_candidates_eligibility_review
  on public.scholarship_discovery_candidates (eligibility_review_status, eligibility_reviewed_at);
