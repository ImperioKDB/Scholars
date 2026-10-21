-- Community consent is tied to the phone number shown when the user accepted.
-- If a regular profile update changes that number, revoke the invitation consent
-- and require the user to affirm again for the replacement number.
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
    ELSE
      IF NEW.whatsapp_community_invite_opt_in IS DISTINCT FROM OLD.whatsapp_community_invite_opt_in
        OR NEW.whatsapp_community_invite_consented_at IS DISTINCT FROM OLD.whatsapp_community_invite_consented_at
        OR NEW.whatsapp_community_invite_withdrawn_at IS DISTINCT FROM OLD.whatsapp_community_invite_withdrawn_at
        OR NEW.whatsapp_community_invite_notice_version IS DISTINCT FROM OLD.whatsapp_community_invite_notice_version
      THEN
        RAISE EXCEPTION USING
          ERRCODE = '42501',
          MESSAGE = 'Community invitation consent must be changed through the authenticated consent endpoint';
      END IF;

      IF NEW.whatsapp_number IS DISTINCT FROM OLD.whatsapp_number
        AND OLD.whatsapp_community_invite_opt_in IS TRUE
      THEN
        NEW.whatsapp_community_invite_opt_in := false;
        NEW.whatsapp_community_invite_withdrawn_at := statement_timestamp();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
