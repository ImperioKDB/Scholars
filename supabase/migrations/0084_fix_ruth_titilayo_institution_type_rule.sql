-- Correct the Ruth Titilayo scholarship metadata.
-- "Polytechnic students in Nigeria" describes institution category, not a field
-- of study. Keep the catalog discipline open and represent the requirement in
-- the rule engine's institution_type field.
do $migration$
declare
  v_scholarship_id uuid;
begin
  select id into v_scholarship_id
  from public.scholarships
  where title = 'Ruth Titilayo Polytechnic Scholarship 2027'
    and provider_name = 'Ruth Titilayo Educational Foundation'
  limit 1;

  if v_scholarship_id is not null then
    update public.scholarships
    set discipline = null
    where id = v_scholarship_id
      and discipline = 'Polytechnic students in Nigeria';

    insert into public.scholarship_rules (scholarship_id, field, operator, value)
    select v_scholarship_id, 'institution_type', 'eq', '"polytechnic"'::jsonb
    where not exists (
      select 1
      from public.scholarship_rules
      where scholarship_id = v_scholarship_id
        and field = 'institution_type'
        and operator = 'eq'
        and value = '"polytechnic"'::jsonb
    );
  end if;
end
$migration$;
