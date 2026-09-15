-- Add a lease to outbound notification intents so a worker can claim work
-- without two overlapping runs sending the same intent.
alter table public.notification_deliveries
  add column if not exists lease_until timestamptz;

create index if not exists idx_notification_deliveries_lease
  on public.notification_deliveries (status, lease_until, available_at);
