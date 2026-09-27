-- First-party browser error monitoring for authenticated and anonymous visitors.
-- Store only bounded diagnostic context; never request bodies, tokens, form values,
-- full stack traces, or arbitrary client payloads.

CREATE TABLE IF NOT EXISTS public.monitoring_error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('runtime_error', 'unhandled_rejection', 'route_error', 'root_error')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 240),
  source text CHECK (source IS NULL OR char_length(source) <= 240),
  pathname text CHECK (pathname IS NULL OR char_length(pathname) <= 240),
  digest text CHECK (digest IS NULL OR char_length(digest) <= 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.monitoring_error_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monitoring_errors_insert_own_or_anonymous" ON public.monitoring_error_events;
CREATE POLICY "monitoring_errors_insert_own_or_anonymous"
  ON public.monitoring_error_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (profile_id IS NULL OR profile_id = auth.uid());

DROP POLICY IF EXISTS "monitoring_errors_select_admin" ON public.monitoring_error_events;
CREATE POLICY "monitoring_errors_select_admin"
  ON public.monitoring_error_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_monitoring_error_events_created
  ON public.monitoring_error_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_error_events_kind_created
  ON public.monitoring_error_events (kind, created_at DESC);
