-- Admin moderation access for scholarship discussions.
-- No data is deleted; hidden posts remain available to the moderation queue.

DROP POLICY IF EXISTS scholarship_discussions_admin_select ON public.scholarship_discussions;
CREATE POLICY scholarship_discussions_admin_select
  ON public.scholarship_discussions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS scholarship_discussions_admin_update ON public.scholarship_discussions;
CREATE POLICY scholarship_discussions_admin_update
  ON public.scholarship_discussions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS scholarship_discussion_reports_admin_select ON public.scholarship_discussion_reports;
CREATE POLICY scholarship_discussion_reports_admin_select
  ON public.scholarship_discussion_reports FOR SELECT TO authenticated
  USING (
    auth.uid() = reporter_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS scholarship_discussion_reports_admin_update ON public.scholarship_discussion_reports;
CREATE POLICY scholarship_discussion_reports_admin_update
  ON public.scholarship_discussion_reports FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

GRANT UPDATE ON public.scholarship_discussions TO authenticated;
GRANT UPDATE ON public.scholarship_discussion_reports TO authenticated;
