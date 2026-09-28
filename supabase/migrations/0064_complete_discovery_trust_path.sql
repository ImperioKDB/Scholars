-- Complete the discovery trust path without deleting or rewriting existing data.

alter table public.discovery_sources add column if not exists freshness_ttl_hours integer not null default 168;
alter table public.discovery_sources add constraint discovery_sources_freshness_ttl_check check (freshness_ttl_hours between 1 and 8760);

alter table public.scholarship_discovery_candidates add column if not exists freshness_status text not null default 'unknown';
alter table public.scholarship_discovery_candidates add column if not exists last_verified_content_hash text;
alter table public.scholarship_discovery_candidates add column if not exists stale_after timestamptz;
alter table public.scholarship_discovery_candidates add column if not exists material_change_detected_at timestamptz;
alter table public.scholarship_discovery_candidates add constraint discovery_candidates_freshness_status_check check (freshness_status in ('unknown', 'current', 'stale', 'changed', 'blocked'));
create index if not exists idx_discovery_candidates_freshness on public.scholarship_discovery_candidates (freshness_status, stale_after);

create table if not exists public.scholarship_discovery_review_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.scholarship_discovery_candidates(id) on delete cascade,
  claim_id uuid references public.scholarship_discovery_candidate_claims(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('claim_confirmed', 'claim_rejected', 'candidate_reviewed', 'published', 'reverified', 'material_change_detected', 'rule_compiled')),
  previous_value jsonb,
  new_value jsonb,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_discovery_review_events_candidate on public.scholarship_discovery_review_events (candidate_id, created_at desc);
alter table public.scholarship_discovery_review_events enable row level security;
drop policy if exists "discovery_review_events_select_admin" on public.scholarship_discovery_review_events;
create policy "discovery_review_events_select_admin" on public.scholarship_discovery_review_events for select using (is_admin(auth.uid()));

create or replace function public.claim_workflow_job(p_kind text, p_lease_until timestamptz)
returns setof public.workflow_jobs
language sql
security definer
set search_path = public
as $$
  update public.workflow_jobs as job
  set status = 'leased', lease_until = p_lease_until, attempts = job.attempts + 1
  where job.id = (
    select candidate.id
    from public.workflow_jobs as candidate
    where candidate.kind = p_kind
      and candidate.status in ('pending', 'retryable')
      and candidate.available_at <= now()
      and (candidate.lease_until is null or candidate.lease_until < now())
    order by candidate.available_at asc, candidate.created_at asc
    for update skip locked
    limit 1
  )
  returning job.*;
$$;
revoke all on function public.claim_workflow_job(text, timestamptz) from public;
grant execute on function public.claim_workflow_job(text, timestamptz) to service_role;

create or replace function public.complete_workflow_job(p_job_id uuid, p_success boolean, p_result jsonb default null, p_error jsonb default null, p_retry_at timestamptz default null)
returns public.workflow_jobs
language plpgsql
security definer
set search_path = public
as $$
declare result_row public.workflow_jobs;
begin
  update public.workflow_jobs
  set status = case when p_success then 'succeeded' when p_retry_at is null or attempts >= 5 then 'dead_letter' else 'retryable' end,
      available_at = coalesce(p_retry_at, available_at),
      lease_until = null,
      result_metadata = p_result,
      last_error = p_error,
      completed_at = case when p_success or p_retry_at is null or attempts >= 5 then now() else null end
  where id = p_job_id and status = 'leased'
  returning * into result_row;
  return result_row;
end;
$$;
revoke all on function public.complete_workflow_job(uuid, boolean, jsonb, jsonb, timestamptz) from public;
grant execute on function public.complete_workflow_job(uuid, boolean, jsonb, jsonb, timestamptz) to service_role;

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
  compiled_count integer := 0;
begin
  if actor_id is null or not public.is_admin(actor_id) then raise exception using errcode = '42501', message = 'Admin access required'; end if;
  select * into candidate_row from public.scholarship_discovery_candidates where id = candidate_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Candidate not found'; end if;
  if candidate_row.status <> 'approved' then raise exception using errcode = '22023', message = 'Only approved candidates can be published'; end if;
  if candidate_row.quality_status <> 'ready' then raise exception using errcode = '22023', message = 'Candidate must pass quality scoring before publication'; end if;
  if candidate_row.verification_status not in ('verified', 'redirected') then raise exception using errcode = '22023', message = 'Candidate must pass URL verification before publication'; end if;
  if candidate_row.freshness_status not in ('current', 'changed') or candidate_row.stale_after is null or candidate_row.stale_after < now() then raise exception using errcode = '22023', message = 'Candidate evidence is stale or has not completed freshness verification'; end if;
  if candidate_row.eligibility_review_status <> 'reviewed' or candidate_row.eligibility_verdict not in ('eligible', 'likely_eligible') then raise exception using errcode = '22023', message = 'Candidate needs a reviewed eligibility outcome before publication'; end if;
  if not exists (select 1 from public.scholarship_discovery_candidate_claims c where c.candidate_id = candidate_row.id and c.review_status = 'confirmed' and c.field in ('nationality', 'level')) then raise exception using errcode = '22023', message = 'Candidate needs confirmed nationality and study-level evidence'; end if;
  if nullif(trim(candidate_row.application_url), '') is null then raise exception using errcode = '22023', message = 'Candidate needs an application URL before publication'; end if;
  if candidate_row.published_scholarship_id is not null then return jsonb_build_object('candidate_id', candidate_row.id, 'scholarship_id', candidate_row.published_scholarship_id, 'already_published', true); end if;
  scholarship_level := case when candidate_row.level = 'undergraduate' then 'undergrad'::scholarship_level when candidate_row.level = 'postgraduate' then 'postgrad'::scholarship_level else 'both'::scholarship_level end;
  insert into public.scholarships (title, provider_name, description, amount, deadline, application_url, level, discipline, verified, created_by, research_notes, last_verified_at)
  values (candidate_row.title, candidate_row.provider_name, candidate_row.description, candidate_row.amount, candidate_row.deadline, candidate_row.application_url, scholarship_level, candidate_row.discipline, false, actor_id, concat('Discovery evidence:', E'\n', candidate_row.evidence_excerpt, E'\n\nSource: ', candidate_row.source_url, E'\n', coalesce(candidate_row.eligibility_notes, '')), candidate_row.last_verified_at)
  returning id into scholarship_id;
  insert into public.scholarship_rules (scholarship_id, field, operator, value)
  select scholarship_id, c.field, c.operator::rule_operator, c.value_json
  from public.scholarship_discovery_candidate_claims c
  where c.candidate_id = candidate_row.id and c.review_status = 'confirmed' and c.field in ('discipline', 'gpa', 'nationality', 'gender', 'financial_need', 'age', 'state_of_origin', 'lga_of_origin', 'year_of_study', 'institution_type', 'jamb_score', 'waec_credit_count', 'has_english_maths_credit', 'disability_status') and c.operator in ('eq', 'gte', 'lte', 'in', 'exists');
  get diagnostics compiled_count = row_count;
  update public.scholarship_discovery_candidates set status = 'published', published_scholarship_id = scholarship_id, published_at = now(), reviewed_by = actor_id, reviewed_at = now(), updated_at = now() where id = candidate_row.id;
  insert into public.scholarship_discovery_review_events (candidate_id, actor_id, event_type, new_value, notes) values (candidate_row.id, actor_id, 'published', jsonb_build_object('scholarship_id', scholarship_id, 'compiled_rules', compiled_count), 'Published through the atomic readiness gate.');
  return jsonb_build_object('candidate_id', candidate_row.id, 'scholarship_id', scholarship_id, 'compiled_rules', compiled_count, 'already_published', false);
end;
$$;
revoke all on function public.publish_discovery_candidate(uuid) from public;
grant execute on function public.publish_discovery_candidate(uuid) to authenticated;
