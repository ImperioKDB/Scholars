-- Per-recipient broadcast delivery log.
-- Keeps delivery attempts observable without storing message bodies.
create table if not exists public.broadcast_delivery_log (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null,
  recipient_email text not null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  status text not null check (status in ('sent', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  provider_message text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_broadcast_delivery_log_broadcast
  on public.broadcast_delivery_log (broadcast_id, created_at desc);

create index if not exists idx_broadcast_delivery_log_recipient
  on public.broadcast_delivery_log (recipient_email, created_at desc);

alter table public.broadcast_delivery_log enable row level security;
