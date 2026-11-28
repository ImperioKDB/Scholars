begin read only;
do $$
declare
  item record;
  populated boolean;
begin
  for item in
    select schemaname, tablename from pg_tables
    where schemaname = 'public'
      or (schemaname = 'auth' and tablename in ('users', 'identities'))
  loop
    execute format('select exists (select 1 from %I.%I)', item.schemaname, item.tablename)
      into populated;
    if populated then
      raise exception 'Expected an empty fixture table: %.%', item.schemaname, item.tablename;
    end if;
  end loop;
  if to_regclass('cron.job') is not null then
    raise exception 'Expected scheduler tables to be absent';
  end if;
end;
$$;
select 'Zero rows across public tables and Auth users/identities; pg_cron job table absent' as result;
rollback;
