-- Phase 1: safe scholarship discovery ingestion.
-- Candidates are isolated from the public catalogue until an administrator approves them.
create table if not exists public.discovery_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_url text not null,
  source_type text not null check (source_type in ('official', 'provider', 'institutional', 'secondary')),
  trust_tier text not null default 'review' check (trust_tier in ('primary', 'review')),
  enabled boolean not null default false,
  crawl_policy text not null default 'manual',
  last_crawled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.scholarship_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.discovery_sources(id) on delete restrict,
  source_url text not null,
  application_url text,
  canonical_url text,
  title text not null,
  provider_name text not null,
  description text,
  amount text,
  deadline date,
  level text not null default 'unclear' check (level in ('undergraduate', 'postgraduate', 'secondary', 'multiple', 'unclear')),
  discipline text,
  eligibility_notes text,
  evidence_excerpt text not null,
  fetched_at timestamptz not null default now(),
  content_hash text,
  confidence numeric(4,3) check (confidence >= 0 and confidence <= 1),
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'stale')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.discovery_sources enable row level security;
alter table public.scholarship_discovery_candidates enable row level security;

drop policy if exists "discovery_sources_select_admin" on public.discovery_sources;
create policy "discovery_sources_select_admin" on public.discovery_sources
  for select using (is_admin(auth.uid()));
drop policy if exists "discovery_candidates_select_admin" on public.scholarship_discovery_candidates;
create policy "discovery_candidates_select_admin" on public.scholarship_discovery_candidates
  for select using (is_admin(auth.uid()));

create index if not exists idx_discovery_sources_enabled on public.discovery_sources (enabled, trust_tier);
create index if not exists idx_discovery_candidates_review on public.scholarship_discovery_candidates (status, created_at desc);
create index if not exists idx_discovery_candidates_source on public.scholarship_discovery_candidates (source_id, fetched_at desc);
create index if not exists idx_discovery_candidates_canonical on public.scholarship_discovery_candidates (canonical_url)
  where canonical_url is not null;

comment on table public.scholarship_discovery_candidates is
  'Unpublished scholarship discoveries. Candidates require administrator review before entering the public catalogue.';
