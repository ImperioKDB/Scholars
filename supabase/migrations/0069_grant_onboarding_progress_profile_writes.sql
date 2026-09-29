-- The onboarding client records the current step through POST /api/profile.
-- These columns were added after the original column-scoped profile grants,
-- so the tracking upsert was rejected even though normal profile fields were
-- writable. Keep the grants narrow and preserve the existing RLS owner checks.

grant insert (
  id,
  full_name,
  onboarding_step,
  onboarding_last_activity_at
) on table public.profiles to authenticated;

grant update (
  onboarding_step,
  onboarding_last_activity_at
) on table public.profiles to authenticated;
