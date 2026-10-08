-- Account-level onboarding prompt actions. Nullable means the student remains
-- eligible until the corresponding action is actually recorded.
alter table public.profiles
  add column if not exists pwa_installed_at timestamptz,
  add column if not exists push_enable_clicked_at timestamptz;

comment on column public.profiles.pwa_installed_at is
  'When this account was observed installing Scholars on any device.';
comment on column public.profiles.push_enable_clicked_at is
  'When this account clicked Enable notifications in a Scholars prompt.';

-- Existing profiles RLS policies already constrain writes to auth.uid() = id.
-- Keep the new fields explicitly column-scoped for authenticated self-service.
grant update (pwa_installed_at, push_enable_clicked_at)
  on table public.profiles to authenticated;
