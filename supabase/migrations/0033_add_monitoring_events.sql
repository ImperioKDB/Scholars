-- Monitoring events for first-party performance and client-error visibility.
-- No raw request bodies, auth tokens, form contents, or full stack traces are stored.
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
      'whatsapp_opt_out',
      'page_viewed',
      'web_vital',
      'client_error'
    )
  );
