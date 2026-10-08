-- Browser Web Push subscriptions are private capabilities. Store them per
-- account, allow the owner to manage only their own devices, and cascade them
-- away when an account is deleted. Existing Expo push_tokens remain unchanged.
CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL CHECK (endpoint LIKE 'https://%'),
  p256dh text NOT NULL,
  auth text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_profile_enabled
  ON public.web_push_subscriptions (profile_id, last_seen_at DESC)
  WHERE enabled = true;

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_push_subscriptions TO authenticated;

DROP POLICY IF EXISTS web_push_subscriptions_select_own ON public.web_push_subscriptions;
CREATE POLICY web_push_subscriptions_select_own
  ON public.web_push_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS web_push_subscriptions_insert_own ON public.web_push_subscriptions;
CREATE POLICY web_push_subscriptions_insert_own
  ON public.web_push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS web_push_subscriptions_update_own ON public.web_push_subscriptions;
CREATE POLICY web_push_subscriptions_update_own
  ON public.web_push_subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS web_push_subscriptions_delete_own ON public.web_push_subscriptions;
CREATE POLICY web_push_subscriptions_delete_own
  ON public.web_push_subscriptions
  FOR DELETE TO authenticated
  USING (auth.uid() = profile_id);
