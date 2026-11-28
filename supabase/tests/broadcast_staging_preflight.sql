do $$
begin
  if to_regclass('public.profiles') is null or to_regclass('public.scholarships') is null
    or to_regclass('public.opportunities') is null or to_regclass('public.announcement_log') is null
    or to_regclass('public.broadcast_delivery_log') is null or to_regclass('public.notification_deliveries') is null
    or to_regclass('public.workflow_jobs') is null or to_regclass('public.push_tokens') is null
    or to_regclass('public.web_push_subscriptions') is null then
    raise exception 'The Scholars baseline schema is missing. Load the reviewed schema-only baseline first.';
  end if;
  if exists (
    select 1 from auth.users where email is null or (
      email not in ('broadcast-qualification-admin@broadcast.example.invalid')
      and email !~ '^broadcast-qualification-[0-9]{3}@broadcast\.example\.invalid$'
    )
  ) then
    raise exception 'The staging project contains users outside the broadcast qualification fixture.';
  end if;
  if exists (
    select 1 from public.push_tokens
    where enabled and expo_push_token !~ '^ExpoPushToken\[BroadcastQualification[0-9]{3}\]$'
  ) or exists (
    select 1 from public.web_push_subscriptions
    where enabled and endpoint !~ '^https://fcm\.googleapis\.com/send/broadcast-qualification-[0-9]{3}$'
  ) then
    raise exception 'The staging project contains non-synthetic push targets.';
  end if;
end;
$$;
