-- Add the push channel to the existing private notification outbox.
-- Existing email/WhatsApp rows and delivery history remain unchanged.
alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_channel_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_channel_check
  check (channel = any (array['email'::text, 'whatsapp'::text, 'push'::text]));
