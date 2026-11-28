-- Operator input via psql -v. The caller selects the approved database.
-- additional is verified spendable capacity after other traffic and all prior attempts.
\set ON_ERROR_STOP on
begin;
create temporary table allocation_input (
  provider text, period text, starts_at timestamptz, ends_at timestamptz, additional integer
) on commit drop;
insert into allocation_input values (:'provider', :'period', :'starts_at', :'ends_at', :'additional');

do $$
declare
  requested pg_temp.allocation_input%rowtype;
  existing public.broadcast_provider_windows%rowtype;
  cap integer;
begin
  select * into strict requested from pg_temp.allocation_input;
  cap := case
    when requested.provider = 'brevo' and requested.period = 'daily' then 300
    when requested.provider = 'resend' and requested.period = 'daily' then 100
    when requested.provider = 'resend' and requested.period = 'monthly' then 3000
  end;
  if cap is null or requested.additional < 0 or requested.ends_at <= clock_timestamp()
    or requested.ends_at <= requested.starts_at then
    raise exception 'Invalid or expired provider allocation';
  end if;

  insert into public.broadcast_provider_state(provider_key) values (requested.provider) on conflict do nothing;
  perform 1 from public.broadcast_provider_state where provider_key = requested.provider for update;
  select * into existing from public.broadcast_provider_windows
    where provider = requested.provider and period = requested.period and starts_at = requested.starts_at for update;
  if found and existing.ends_at <> requested.ends_at then
    raise exception 'Existing allocation reset boundary differs';
  end if;
  if exists (
    select 1 from public.broadcast_provider_windows
    where provider = requested.provider and period = requested.period and starts_at <> requested.starts_at
      and starts_at < requested.ends_at and ends_at > requested.starts_at
  ) then
    raise exception 'Provider allocation overlaps another window';
  end if;
  if requested.additional > cap - coalesce(existing.reserved, 0) then
    raise exception 'Verified additional capacity exceeds the permitted provider cap';
  end if;

  insert into public.broadcast_provider_windows(provider,period,starts_at,ends_at,allowance)
    values (requested.provider,requested.period,requested.starts_at,requested.ends_at,
      coalesce(existing.reserved, 0) + requested.additional)
  on conflict (provider,period,starts_at) do update set allowance = excluded.allowance;
end;
$$;

select provider, period, starts_at, ends_at, allowance, reserved, allowance - reserved as available
from public.broadcast_provider_windows
where provider = :'provider' and period = :'period' and starts_at = :'starts_at'::timestamptz;
commit;
