-- Activation funnel v2: add the events needed to measure the path from
-- onboarding through application follow-through.
--
-- This migration changes only the existing analytics whitelist. It does not
-- alter user data, application statuses, or matching behavior.
-- Apply through the project's normal Supabase migration workflow.

alter table public.events
  drop constraint if exists events_event_whitelist;

alter table public.events
  add constraint events_event_whitelist check (
    event in (
      'profile_created',
      'profile_completed',
      'onboarding_step_viewed',
      'provisional_matches_viewed',
      'match_viewed',
      'scholarship_saved',
      'application_started',
      'provider_clicked',
      'application_status_changed',
      'draft_generated',
      'draft_confirmed',
      'gap_nudge_clicked',
      'whatsapp_opt_in',
      'whatsapp_opt_out'
    )
  );
