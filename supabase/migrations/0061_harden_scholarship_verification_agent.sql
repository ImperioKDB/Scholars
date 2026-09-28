-- Scholarship Verification Agent hardening.
-- Additive only: preserve existing discovery and catalogue data.

create table if not exists public.scholarship_discovery_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.scholarship_discovery_candidates(id) on delete cascade,
  run_id uuid,
  requested_url text not null,
  final_url text,
  http_status integer,
  status text not null check (status in ('verified', 'redirected', 'unreachable', 'blocked', 'error')),
  notes text,
  content_hash text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_discovery_verification_attempts_candidate
  on public.scholarship_discovery_verification_attempts (candidate_id, checked_at desc);

alter table public.scholarship_discovery_verification_attempts enable row level security;
drop policy if exists "discovery_verification_attempts_select_admin" on public.scholarship_discovery_verification_attempts;
create policy "discovery_verification_attempts_select_admin"
  on public.scholarship_discovery_verification_attempts
  for select using (is_admin(auth.uid()));

-- The admin API uses the authenticated session client for review mutations.
drop policy if exists "discovery_sources_admin_update" on public.discovery_sources;
create policy "discovery_sources_admin_update"
  on public.discovery_sources
  for update using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

drop policy if exists "discovery_candidates_admin_update" on public.scholarship_discovery_candidates;
create policy "discovery_candidates_admin_update"
  on public.scholarship_discovery_candidates
  for update using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create or replace function public.publish_discovery_candidate(candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  candidate_row public.scholarship_discovery_candidates%rowtype;
  scholarship_id uuid;
  scholarship_level scholarship_level;
begin
  if actor_id is null or not public.is_admin(actor_id) then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;

  select * into candidate_row
  from public.scholarship_discovery_candidates
  where id = candidate_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Candidate not found';
  end if;
  if candidate_row.status <> 'approved' then
    raise exception using errcode = '22023', message = 'Only approved candidates can be published';
  end if;
  if candidate_row.quality_status <> 'ready' then
    raise exception using errcode = '22023', message = 'Candidate must pass quality scoring before publication';
  end if;
  if candidate_row.verification_status not in ('verified', 'redirected') then
    raise exception using errcode = '22023', message = 'Candidate must pass URL verification before publication';
  end if;
  if nullif(trim(candidate_row.application_url), '') is null then
    raise exception using errcode = '22023', message = 'Candidate needs an application URL before publication';
  end if;
  if candidate_row.published_scholarship_id is not null then
    return jsonb_build_object('candidate_id', candidate_row.id, 'scholarship_id', candidate_row.published_scholarship_id, 'already_published', true);
  end if;

  scholarship_level := case
    when candidate_row.level = 'undergraduate' then 'undergrad'::scholarship_level
    when candidate_row.level = 'postgraduate' then 'postgrad'::scholarship_level
    else 'both'::scholarship_level
  end;

  insert into public.scholarships (
    title, provider_name, description, amount, deadline, application_url,
    level, discipline, verified, created_by, research_notes, last_verified_at
  ) values (
    candidate_row.title, candidate_row.provider_name, candidate_row.description,
    candidate_row.amount, candidate_row.deadline, candidate_row.application_url,
    scholarship_level, candidate_row.discipline, false, actor_id,
    concat('Discovery evidence:', E'\n', candidate_row.evidence_excerpt, E'\n\nSource: ', candidate_row.source_url, E'\n', coalesce(candidate_row.eligibility_notes, '')),
    null
  ) returning id into scholarship_id;

  update public.scholarship_discovery_candidates
  set status = 'published', published_scholarship_id = scholarship_id,
      published_at = now(), reviewed_by = actor_id, reviewed_at = now(), updated_at = now()
  where id = candidate_row.id;

  return jsonb_build_object('candidate_id', candidate_row.id, 'scholarship_id', scholarship_id, 'already_published', false);
end;
$$;

revoke all on function public.publish_discovery_candidate(uuid) from public;
grant execute on function public.publish_discovery_candidate(uuid) to authenticated;

comment on function public.publish_discovery_candidate(uuid) is
  'Atomically promotes an approved, quality-ready, URL-verified discovery candidate into the catalogue.';
