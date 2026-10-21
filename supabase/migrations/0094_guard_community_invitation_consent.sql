-- Older profile-upsert compatibility grants UPDATE on the profiles table to
-- authenticated users. Preserve those existing profile writes, but require
-- purpose-specific invitation consent changes to pass through the server API,
-- which uses the service-role key after authenticating the current user.
CREATE OR REPLACE FUNCTION public.guard_community_invitation_consent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.whatsapp_community_invite_opt_in IS DISTINCT FROM false
        OR NEW.whatsapp_community_invite_consented_at IS NOT NULL
        OR NEW.whatsapp_community_invite_withdrawn_at IS NOT NULL
        OR NEW.whatsapp_community_invite_notice_version IS NOT NULL
      THEN
        RAISE EXCEPTION USING
          ERRCODE = '42501',
          MESSAGE = 'Community invitation consent must be changed through the authenticated consent endpoint';
      END IF;
    ELSIF NEW.whatsapp_community_invite_opt_in IS DISTINCT FROM OLD.whatsapp_community_invite_opt_in
      OR NEW.whatsapp_community_invite_consented_at IS DISTINCT FROM OLD.whatsapp_community_invite_consented_at
      OR NEW.whatsapp_community_invite_withdrawn_at IS DISTINCT FROM OLD.whatsapp_community_invite_withdrawn_at
      OR NEW.whatsapp_community_invite_notice_version IS DISTINCT FROM OLD.whatsapp_community_invite_notice_version
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Community invitation consent must be changed through the authenticated consent endpoint';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_community_invitation_consent() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_community_invitation_consent ON public.profiles;
CREATE TRIGGER guard_community_invitation_consent
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_community_invitation_consent();
