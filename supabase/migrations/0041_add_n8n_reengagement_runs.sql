-- Log every authenticated n8n orchestration request without storing secrets or email addresses.
create table if not exists public.n8n_reengagement_runs (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.reengagement_experiments(id) on delete cascade,
  requested_action text not null check (requested_action in ('enroll', 'status')),
  result_status text not null check (result_status in ('accepted', 'rejected', 'failed')),
  queued_count integer not null default 0 check (queued_count >= 0),
  request_id text not null,
  error_code text,
  created_at timestamptz not null default now()
);

alter table public.n8n_reengagement_runs enable row level security;
drop policy if exists "n8n_reengagement_runs_select_admin" on public.n8n_reengagement_runs;
create policy "n8n_reengagement_runs_select_admin" on public.n8n_reengagement_runs
  for select using (is_admin(auth.uid()));

create index if not exists idx_n8n_reengagement_runs_experiment
  on public.n8n_reengagement_runs (experiment_id, created_at desc);
create unique index if not exists idx_n8n_reengagement_runs_request
  on public.n8n_reengagement_runs (request_id);
