-- Preserve failed delivery history after retry exhaustion.
alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_status_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_status_check
  check (status in ('pending', 'leased', 'accepted', 'delivered', 'bounced', 'suppressed', 'failed', 'retryable', 'dead_letter'));

create index if not exists idx_notification_deliveries_dead_letter
  on public.notification_deliveries (campaign_key, status, created_at desc)
  where status = 'dead_letter';
