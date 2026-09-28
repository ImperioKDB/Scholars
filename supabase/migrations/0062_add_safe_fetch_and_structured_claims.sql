-- Safe fetch and structured extraction foundations.
-- Additive only: preserve the existing discovery ledger and publication flow.

alter table public.discovery_sources add column if not exists allowed_hosts text[] not null default '{}';
alter table public.discovery_sources add column if not exists allow_external_application_host boolean not null default false;
alter table public.discovery_sources add column if not exists max_redirects smallint not null default 5;
alter table public.discovery_sources add column if not exists max_fetch_bytes integer not null default 1500000;
alter table public.discovery_sources add column if not exists fetch_timeout_ms integer not null default 12000;
alter table public.discovery_sources add column if not exists fetch_policy_version text not null default 'safe-fetch-v1';
alter table public.discovery_sources add constraint discovery_sources_max_redirects_check check (max_redirects between 0 and 10);
alter table public.discovery_sources add constraint discovery_sources_max_fetch_bytes_check check (max_fetch_bytes between 10000 and 10000000);
alter table public.discovery_sources add constraint discovery_sources_fetch_timeout_check check (fetch_timeout_ms between 1000 and 60000);

create table if not exists public.scholarship_discovery_fetch_snapshots (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.scholarship_discovery_candidates(id) on delete cascade,
  requested_url text not null,
  final_url text,
  redirect_chain jsonb not null default '[]'::jsonb,
  http_status integer,
  content_type text,
  byte_length integer,
  content_hash text,
  status text not null check (status in ('ok', 'blocked', 'unreachable', 'too_large', 'unsupported', 'error')),
  error_code text,
  policy_version text not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_discovery_fetch_snapshots_candidate on public.scholarship_discovery_fetch_snapshots (candidate_id, fetched_at desc);

create table if not exists public.scholarship_discovery_candidate_claims (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.scholarship_discovery_candidates(id) on delete cascade,
  field text not null,
  value_json jsonb,
  operator text,
  source_url text not null,
  evidence_quote text not null,
  confidence numeric(4,3) check (confidence >= 0 and confidence <= 1),
  extraction_method text not null check (extraction_method in ('adapter', 'deterministic', 'ai', 'human')),
  extractor_version text not null,
  model_name text,
  prompt_hash text,
  input_hash text,
  review_status text not null default 'proposed' check (review_status in ('proposed', 'confirmed', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_discovery_candidate_claims_review on public.scholarship_discovery_candidate_claims (candidate_id, review_status, field);

alter table public.scholarship_discovery_fetch_snapshots enable row level security;
alter table public.scholarship_discovery_candidate_claims enable row level security;
drop policy if exists "discovery_fetch_snapshots_select_admin" on public.scholarship_discovery_fetch_snapshots;
create policy "discovery_fetch_snapshots_select_admin" on public.scholarship_discovery_fetch_snapshots for select using (is_admin(auth.uid()));
drop policy if exists "discovery_candidate_claims_select_admin" on public.scholarship_discovery_candidate_claims;
create policy "discovery_candidate_claims_select_admin" on public.scholarship_discovery_candidate_claims for select using (is_admin(auth.uid()));

alter table public.scholarship_discovery_candidates add column if not exists extraction_status text not null default 'unextracted';
alter table public.scholarship_discovery_candidates add column if not exists extractor_version text;
alter table public.scholarship_discovery_candidates add column if not exists extraction_input_hash text;
alter table public.scholarship_discovery_candidates add constraint discovery_candidates_extraction_status_check check (extraction_status in ('unextracted', 'complete', 'partial', 'unclear', 'failed'));
create index if not exists idx_discovery_candidates_extraction on public.scholarship_discovery_candidates (extraction_status, updated_at);
