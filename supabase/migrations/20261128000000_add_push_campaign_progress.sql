-- Durable progress tracking for the daily new-match push campaign.
-- Additive only: no existing rows, tables, buckets, or data are deleted.
-- This table lets the campaign resume deterministically across invocations
-- so later recipients are never permanently starved by earlier batches.
-- Service-role/worker ledger. RLS enabled with no public policies.

create table if not exists public.push_campaign_progress (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'new_match',
  phase text not null default 'discovery' check (phase in ('discovery', 'delivery', 'complete')),
  last_profile_id text,
  last_scholarship_offset integer not null default 0 check (last_scholarship_offset >= 0),
  processed_profiles integer not null default 0 check (processed_profiles >= 0),
  delivered_profiles integer not null default 0 check (delivered_profiles >= 0),
  budget_exhausted boolean not null default false,
  subrequests_used integer not null default 0 check (subrequests_used >= 0),
  subrequest_budget integer not null default 0 check (subrequest_budget >= 0),
  lease_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint push_campaign_progress_one_per_kind unique (kind)
);

alter table public.push_campaign_progress enable row level security;

-- Service-role only: browser roles must never read or write campaign progress.
revoke all on table public.push_campaign_progress from public;
grant select, insert, update, delete on table public.push_campaign_progress to service_role;

create index if not exists idx_push_campaign_progress_kind_lease
  on public.push_campaign_progress (kind, lease_until)
  where lease_until is not null;

create index if not exists idx_push_campaign_progress_kind_updated
  on public.push_campaign_progress (kind, updated_at desc);

comment on table public.push_campaign_progress is
  'Durable cursor for the daily new-match push campaign. Tracks phase, last processed profile, and budget state so later recipients are eventually reached and concurrent invocations cannot claim the same work.';

-- Advisory-lock helper for claiming the campaign row for one invocation.
-- Returns true if the lock was acquired, false if another invocation holds it.
create or replace function public.try_claim_push_campaign(
  p_kind text,
  p_lease_until timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Attempt to acquire a row-level advisory lock scoped to the campaign kind.
  if pg_try_advisory_xact_lock(hashtext(p_kind)) then
    -- Lock acquired: upsert (insert or refresh) the progress row with our lease.
    insert into public.push_campaign_progress (
      kind, phase, last_profile_id, last_scholarship_offset,
      processed_profiles, delivered_profiles, budget_exhausted,
      subrequests_used, subrequest_budget, lease_until, updated_at
    ) values (
      p_kind, 'discovery', null, 0, 0, 0, false, 0, 0, p_lease_until, now()
    )
    on conflict (kind) do update
    set
      lease_until = excluded.lease_until,
      updated_at = now();
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.try_claim_push_campaign(text, timestamptz) from public;
grant execute on function public.try_claim_push_campaign(text, timestamptz) to service_role;

-- Release the campaign lease (called when an invocation finishes or is interrupted).
create or replace function public.release_push_campaign(p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_campaign_progress
  set lease_until = null,
      updated_at = now()
  where kind = p_kind;
end;
$$;

revoke all on function public.release_push_campaign(text) from public;
grant execute on function public.release_push_campaign(text) to service_role;

-- Reclaim a stale lease (older than the lease TTL) so a crashed invocation
-- does not permanently block the campaign. Safe to call idempotently.
create or replace function public.reclaim_stale_push_campaign(
  p_kind text,
  p_lease_ttl_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_try_advisory_xact_lock(hashtext(p_kind)) then
    update public.push_campaign_progress
    set lease_until = null,
        updated_at = now()
    where kind = p_kind
      and lease_until is not null
      and lease_until < now() - (p_lease_ttl_seconds || ' seconds')::interval;
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.reclaim_stale_push_campaign(text, integer) from public;
grant execute on function public.reclaim_stale_push_campaign(text, integer) to service_role;
