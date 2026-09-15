-- Reliability foundation for background work and outbound notifications.
-- Additive only: no existing rows, tables, buckets, or data are deleted.
-- These tables are service-role/worker ledgers. RLS is enabled with no public
-- policies so browser roles cannot read or write job payloads or delivery data.

create table if not exists public.workflow_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'leased', 'succeeded', 'retryable', 'dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  correlation_id uuid,
  last_error jsonb,
  result_metadata jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.workflow_jobs enable row level security;

create index if not exists idx_workflow_jobs_claim
  on public.workflow_jobs (status, available_at, lease_until);
create index if not exists idx_workflow_jobs_kind_status
  on public.workflow_jobs (kind, status, created_at desc);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  scholarship_id uuid references public.scholarships(id) on delete cascade,
  campaign_key text not null,
  channel text not null check (channel in ('email', 'whatsapp')),
  schedule_bucket text not null,
  dedupe_key text not null unique,
  template_version text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'delivered', 'bounced', 'suppressed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  provider_message_id text,
  available_at timestamptz not null default now(),
  last_error jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notification_deliveries enable row level security;

create index if not exists idx_notification_deliveries_claim
  on public.notification_deliveries (status, available_at, created_at);
create index if not exists idx_notification_deliveries_profile
  on public.notification_deliveries (profile_id, created_at desc);
create index if not exists idx_notification_deliveries_provider
  on public.notification_deliveries (provider_message_id)
  where provider_message_id is not null;

comment on table public.workflow_jobs is
  'Durable background-job ledger. Workers must claim with a lease and use idempotency_key.';
comment on table public.notification_deliveries is
  'Idempotent outbound notification ledger. Accepted and delivered are distinct provider states.';
