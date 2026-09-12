-- Add last_seen tracking for active users dashboard
-- Applied live via Supabase MCP on 2026-09-12. This file is a reference
-- record only, per project convention -- do not re-run against the live
-- project.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen DESC);

COMMENT ON COLUMN public.profiles.last_seen IS 'Timestamp of last user activity for active status tracking in admin dashboard';