-- Feedback triage: let admins work the feedback inbox instead of only
-- reading it in the support mailbox. status is a two-state workflow
-- (open -> resolved); resolved_at records when, for response-time sanity.
--
-- RLS: students keep insert-own only. Admins get select (0014) plus a new
-- update policy so the inbox can flip status. No delete policy on purpose:
-- feedback is a record, not a todo -- resolve it, don't erase it.
--
-- Idempotent: safe to re-run.
alter table public.feedback
add column if not exists status text not null default 'open'
  check (status in ('open', 'resolved')),
add column if not exists resolved_at timestamptz;
drop policy if exists "feedback_update_admin" on public.feedback;
create policy "feedback_update_admin"
on public.feedback for update to authenticated
using (is_admin(auth.uid()));
create index if not exists idx_feedback_status_created
on public.feedback (status, created_at desc);
