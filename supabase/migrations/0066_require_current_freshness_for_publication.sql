-- A material content change must be re-reviewed before publication.
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
  if candidate_row.freshness_status <> 'current' or candidate_row.stale_after is null or candidate_row.stale_after < now() then raise exception using errcode = '22023', message = 'Candidate evidence is stale or changed and needs re-verification'; end if;
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
