-- Store consent for one manual invitation to the Scholars Student Community
-- separately from whatsapp_opt_in, which is only for deadline/match reminders.
-- Existing reminder opt-ins remain false for this new purpose; no backfill.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_community_invite_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_community_invite_consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_community_invite_withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_community_invite_notice_version text;

COMMENT ON COLUMN public.profiles.whatsapp_community_invite_opt_in IS
  'Separate, revocable consent to receive one manually sent WhatsApp invitation to the Scholars Student Community. Not implied by reminder consent.';
COMMENT ON COLUMN public.profiles.whatsapp_community_invite_consented_at IS
  'Server-recorded timestamp of the latest explicit community invitation consent.';
COMMENT ON COLUMN public.profiles.whatsapp_community_invite_withdrawn_at IS
  'Server-recorded timestamp of the latest withdrawal of community invitation consent.';
COMMENT ON COLUMN public.profiles.whatsapp_community_invite_notice_version IS
  'Version of the user-facing community invitation consent notice accepted.';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_community_invite_consent_check
  CHECK (
    NOT whatsapp_community_invite_opt_in
    OR (
      whatsapp_community_invite_consented_at IS NOT NULL
      AND whatsapp_community_invite_withdrawn_at IS NULL
      AND whatsapp_community_invite_notice_version IS NOT NULL
      AND whatsapp_number ~ '^[+]234[0-9]{10}$'
    )
  );
