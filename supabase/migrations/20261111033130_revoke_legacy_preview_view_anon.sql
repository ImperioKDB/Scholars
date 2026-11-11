-- Legacy catalogue previews are owner-rights views flagged by Supabase's
-- security advisor. Current public routes use the fixed-field SECURITY INVOKER
-- *_public_preview_v1 views instead. Close the old anonymous REST paths.
-- Explicit authenticated grants, if any, and service_role access are untouched.
--
-- ROLLBACK (re-exposes legacy views): restore only the previous anon/PUBLIC
-- SELECT grants after reviewing each view definition and confirming its fields.

BEGIN;

REVOKE ALL PRIVILEGES ON TABLE
  public.opportunity_public_previews,
  public.scholarship_public_previews
FROM PUBLIC, anon;

COMMIT;
