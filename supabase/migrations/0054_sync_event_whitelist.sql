-- Keep the database analytics backstop aligned with app/api/events/route.ts.
-- This is intentionally additive: every accepted client event is explicit,
-- while arbitrary event names remain rejected at the database boundary.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_event_whitelist;

ALTER TABLE public.events
  ADD CONSTRAINT events_event_whitelist CHECK (
    event IN (
      'profile_created',
      'profile_completed',
      'page_viewed',
      'web_vital',
      'client_error',
      'button_clicked',
      'weekly_focus_viewed',
      'weekly_focus_actioned',
      'onboarding_step_completed',
      'onboarding_abandoned',
      'onboarding_step_viewed',
      'provisional_matches_viewed',
      'match_viewed',
      'scholarship_saved',
      'scholarship_issue_reported',
      'application_started',
      'provider_clicked',
      'application_status_changed',
      'draft_generated',
      'draft_confirmed',
      'gap_nudge_clicked',
      'outcome_recorded',
      'whatsapp_opt_in',
      'whatsapp_opt_out'
    )
  );
