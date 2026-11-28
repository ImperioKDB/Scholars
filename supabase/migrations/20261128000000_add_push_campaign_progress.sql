-- Durable progress tracking for the daily new-match push campaign.
-- Additive only: no existing rows, tables, buckets, or data are deleted.
-- This table lets the campaign resume deterministically across invocations
-- so later recipients are never permanently starved by earlier batches.
-- Service-role/worker ledger. RLS enabled with no public policies.

create table if not exists public.push_campaign_progress (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'new_match',
  last_profile_id text,
  processed_profiles integer not null default 0 check (processed_profiles >= 0),
  budget_exhausted boolean not null default false,
  subrequests_used integer not null default 0 check (subrequests_used >= 0),
  subrequest_budget integer not null default 0 check (subrequest_budget >= 0),
  updated_at timestamptz not null default now()
);

alter table public.push_campaign_progress enable row level security;

create index if not exists idx_push_campaign_progress_kind
  on public.push_campaign_progress (kind, updated_at desc);

comment on table public.push_campaign_progress is
  'Durable cursor for the daily new-match push campaign. Tracks last processed profile so later recipients are eventually reached.';
