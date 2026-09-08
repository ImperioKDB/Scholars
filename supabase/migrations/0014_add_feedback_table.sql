-- Feedback table: students submit bugs, feature requests, scholarship
-- issues, or general complaints. Stored for admin triage via the
-- Supabase dashboard (feedback_select_admin policy) and emailed to
-- support.scholarsteam@gmail.com via the /api/feedback route.
--
-- profile_id is nullable on purpose: a future logged-out feedback path
-- (e.g. from the landing page) can still write here without a user.
-- ON DELETE SET NULL so deleting a student's profile keeps their past
-- feedback intact for historical triage.
--
-- NOT YET APPLIED. Run in the Supabase SQL editor (or MCP execute_sql).
-- Until it is applied, POST /api/feedback will fail on the insert; the
-- Brevo email still fires (dry-run-safe) so feedback isn't silently lost.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('bug', 'feature', 'scholarship', 'other')),
  message text not null check (char_length(message) between 10 and 5000),
  contact_email text,
  page_url text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "feedback_insert_authenticated"
  on public.feedback for insert to authenticated
  with check (auth.uid() = profile_id);

create policy "feedback_select_admin"
  on public.feedback for select
  using (is_admin(auth.uid()));

create index if not exists idx_feedback_created_at
  on public.feedback (created_at desc);

comment on table public.feedback is
  'In-app student feedback (bugs, feature requests, scholarship issues, other).';
