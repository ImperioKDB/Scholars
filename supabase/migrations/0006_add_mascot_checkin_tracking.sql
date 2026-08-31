-- Ade (mascot) check-in tracking.
--
-- link_clicked_at: set the moment a student clicks "Apply on provider's
-- site" for a tracked application. This is the trigger for Ade's next-visit
-- follow-up question -- we can't know if they actually applied, only that
-- they left for the provider's site, so the question is always a genuine
-- ask ("how'd it go?"), never an assumption.
--
-- checkin_prompted_at: last time Ade actually surfaced the follow-up
-- question in the UI. Distinct from link_clicked_at so we can tell "clicked
-- but never asked yet" apart from "asked already, waiting on an answer."
--
-- checkin_snoozed_until: student tapped "ask me later" -- suppress the
-- prompt until this timestamp instead of every session.
--
-- Applied live via Supabase MCP on 2026-08-31. This file is a reference
-- record only, per project convention -- do not re-run against the live
-- project.

alter table public.applications
  add column link_clicked_at timestamptz,
  add column checkin_prompted_at timestamptz,
  add column checkin_snoozed_until timestamptz;

alter type notification_type add value 'checkin_reminder';
