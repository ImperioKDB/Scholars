-- Atomic owner-scoped replacement for WAEC results.
-- The function is SECURITY INVOKER so the table's RLS remains active.
create or replace function public.replace_waec_results(
  p_profile_id uuid,
  p_results jsonb
)
returns table(subject text, grade text)
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_profile_id then
    raise exception 'not authorized';
  end if;

  delete from public.waec_results
  where profile_id = p_profile_id;

  insert into public.waec_results (profile_id, subject, grade)
  select p_profile_id, r.subject, r.grade
  from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) as r(subject text, grade text);

  return query
  select w.subject, w.grade
  from public.waec_results w
  where w.profile_id = p_profile_id
  order by w.subject;
end;
$$;

revoke all on function public.replace_waec_results(uuid, jsonb) from public, anon;
grant execute on function public.replace_waec_results(uuid, jsonb) to authenticated;
