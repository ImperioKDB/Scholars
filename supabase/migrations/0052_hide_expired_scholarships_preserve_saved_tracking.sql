-- Keep expired scholarship rows for students who saved or track them,
-- but remove them from general discovery by setting verified = false.
-- The SELECT policy grants an owner-specific exception so saved and tracked
-- records remain readable through dashboard/application joins.

DROP POLICY IF EXISTS scholarships_select_verified ON public.scholarships;

CREATE POLICY scholarships_select_verified
  ON public.scholarships
  FOR SELECT
  USING (
    verified = true
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.saved_scholarships AS ss
      WHERE ss.scholarship_id = scholarships.id
        AND ss.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.applications AS a
      WHERE a.scholarship_id = scholarships.id
        AND a.profile_id = auth.uid()
    )
  );

UPDATE public.scholarships
SET verified = false,
    updated_at = now()
WHERE id IN (
  'aaaaaaaa-0000-4000-8000-000000000019',
  'cccccccc-0000-4000-8000-000000000021',
  'ee976593-1a58-4ca4-a1d9-a3fc0c855e87',
  '445efa2e-3444-412a-b33a-a81714e040d2',
  'df3d4103-1559-4f69-b9f1-de255d4a3438'
);
