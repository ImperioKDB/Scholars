-- In-app student feedback + self-serve account deletion support.
--
-- feedback: one row per submitted feedback form (see
-- components/FeedbackWidget.tsx, app/api/feedback/route.ts). profile_id is
-- set null on delete so historical feedback survives account deletion in
-- anonymized form. category is constrained to the four options the widget
-- offers; message length is checked here AND in the route's zod schema.
--
-- profiles_delete_own: students can delete their own profile row. FK
-- ON DELETE CASCADE on saved_scholarships / applications / waec_results /
-- notifications / user_achievements / xp_events removes everything attached
-- to it in one statement. The auth user row stays (Supabase Auth owns it);
-- the Settings copy is honest about that and points at support for full
-- erasure.
--
-- IDEMPOTENT: every policy is dropped-then-created, and the table uses
-- IF NOT EXISTS, so this file is safe to run more than once (for example
-- if an earlier partial version was already applied).
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('bug', 'feature', 'scholarship', 'other')),
  message text not null check (char_length(message) between 10 and 2000),
  contact_email text,
  page_url text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own"
  on public.feedback for insert to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "feedback_select_admin" on public.feedback;
create policy "feedback_select_admin"
  on public.feedback for select
  using (is_admin(auth.uid()));

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);
