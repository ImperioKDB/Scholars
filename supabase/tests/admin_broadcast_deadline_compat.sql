-- Runs only after the broadcast and PR #50 migrations have both been applied.
create temporary table before_deadline as
select id, to_jsonb(d) as record
from public.notification_deliveries d where campaign_key in ('admin_broadcast', 'admin_broadcast_v2');

select public.prepare_deadline_reminders(7, 3, false, false);
select id from public.claim_deadline_reminders('push', 7, 3, false, 0, 0);

do $$
begin
  if exists (
    select 1 from before_deadline b
    full join (select * from public.notification_deliveries where campaign_key in ('admin_broadcast','admin_broadcast_v2')) d
      using (id)
    where b.record is distinct from to_jsonb(d)
  ) then
    raise exception 'Deadline operations changed broadcast rows';
  end if;
  if exists (select 1 from public.notification_deliveries where campaign_key = 'deadline_reminder_v2') then
    raise exception 'Untracked broadcast listings enrolled in deadline reminders';
  end if;
end;
$$;
