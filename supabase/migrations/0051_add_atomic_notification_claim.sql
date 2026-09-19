-- Atomically claim one notification delivery for a worker.
-- Service-role only: browser roles must never be able to lease outbound work.
create or replace function public.claim_notification_delivery(
  p_delivery_id uuid,
  p_lease_until timestamptz
)
returns table (id uuid, dedupe_key text)
language sql
security definer
set search_path = public
as $$
  update public.notification_deliveries
  set
    status = 'leased',
    attempts = attempts + 1,
    available_at = now(),
    lease_until = p_lease_until
  where id = p_delivery_id
    and available_at <= now()
    and (
      status = 'pending'
      or status = 'retryable'
      or (status = 'leased' and lease_until < now())
    )
  returning notification_deliveries.id, notification_deliveries.dedupe_key;
$$;

revoke all on function public.claim_notification_delivery(uuid, timestamptz) from public;
grant execute on function public.claim_notification_delivery(uuid, timestamptz) to service_role;
