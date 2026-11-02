-- Restore the verified WAAW eligibility rules that were documented in
-- migration 0101 but accidentally omitted from scholarship_rules.
-- The source says applicants must be female and under 32.
do $migration$
declare
  v_scholarship_id uuid;
begin
  select id into v_scholarship_id
  from public.scholarships
  where application_url = 'https://waawfoundation.org/scholarship/'
     or lower(title) = lower('WAAW Foundation Scholarship 2026/2027')
  order by created_at desc
  limit 1;

  if v_scholarship_id is null then
    raise exception 'WAAW Foundation Scholarship 2026/2027 was not found';
  end if;

  if not exists (
    select 1
    from public.scholarship_rules
    where scholarship_id = v_scholarship_id
      and field = 'gender'
      and operator = 'eq'
      and value = '"female"'::jsonb
    limit 1
  ) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_scholarship_id, 'gender', 'eq', '"female"'::jsonb, true);
  end if;

  if not exists (
    select 1
    from public.scholarship_rules
    where scholarship_id = v_scholarship_id
      and field = 'age'
      and operator = 'lte'
      and value = '31'::jsonb
    limit 1
  ) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_scholarship_id, 'age', 'lte', '31'::jsonb, true);
  end if;
end
$migration$;
