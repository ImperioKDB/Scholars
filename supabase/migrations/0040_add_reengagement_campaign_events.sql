-- Campaign instrumentation for the re-engagement experiment.
-- Public click redirects write through a service-role route; admins can read summaries.
create table if not exists public.reengagement_campaign_events (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.reengagement_experiments(id) on delete cascade,
  assignment_id uuid not null references public.reengagement_assignments(id) on delete cascade,
  event text not null check (event in ('clicked', 'returned', 'onboarding_completed', 'match_viewed', 'saved', 'application_started', 'provider_clicked', 'unsubscribed')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.reengagement_campaign_events enable row level security;
drop policy if exists "reengagement_campaign_events_select_admin" on public.reengagement_campaign_events;
create policy "reengagement_campaign_events_select_admin" on public.reengagement_campaign_events
  for select using (is_admin(auth.uid()));

create index if not exists idx_reengagement_campaign_events_experiment
  on public.reengagement_campaign_events (experiment_id, event, created_at desc);
create index if not exists idx_reengagement_campaign_events_assignment
  on public.reengagement_campaign_events (assignment_id, created_at desc);
