-- Retention and product-usage events. Additive whitelist update only.

alter table public.events
  drop constraint if exists events_event_whitelist;

alter table public.events
  add constraint events_event_whitelist check (
    event in (
      'profile_created',
      'profile_completed',
      'onboarding_step_viewed',
      'onboarding_step_completed',
      'onboarding_abandoned',
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
      'button_clicked',
      'weekly_focus_viewed',
      'weekly_focus_actioned',
      'outcome_recorded',
      'whatsapp_opt_in',
      'whatsapp_opt_out',
      'page_viewed',
      'web_vital',
      'client_error'
    )
  );
