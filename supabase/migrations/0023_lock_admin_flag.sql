-- Privilege fix: ordinary API roles must never write profiles.is_admin.
--
-- This migration is intentionally separate from the obsolete 001 reference
-- SQL. It closes the live self-elevation path at the database privilege layer.

begin;

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Remove broad table privileges from public API roles.
revoke insert, update, delete, truncate, references, trigger
  on table public.profiles
  from anon, authenticated;

-- The auth bootstrap trigger is SECURITY DEFINER. Client code needs only
-- authenticated reads and explicit updates to ordinary profile fields.
grant select on table public.profiles to authenticated;
grant insert (
  id,
  full_name,
  discipline,
  gpa,
  nationality,
  gender,
  financial_need,
  career_goals,
  date_of_birth,
  state_of_origin,
  lga_of_origin,
  year_of_study,
  institution_name,
  institution_type,
  jamb_score,
  waec_credit_count,
  has_english_maths_credit,
  disability_status,
  has_valid_id,
  has_transcript,
  has_recommendation_letter,
  has_personal_statement,
  has_lga_certificate,
  avatar_url,
  whatsapp_opt_in,
  whatsapp_number,
  referred_by
) on table public.profiles to authenticated;
grant update (
  full_name,
  discipline,
  gpa,
  nationality,
  gender,
  financial_need,
  career_goals,
  date_of_birth,
  state_of_origin,
  lga_of_origin,
  year_of_study,
  institution_name,
  institution_type,
  jamb_score,
  waec_credit_count,
  has_english_maths_credit,
  disability_status,
  has_valid_id,
  has_transcript,
  has_recommendation_letter,
  has_personal_statement,
  has_lga_certificate,
  avatar_url,
  whatsapp_opt_in,
  whatsapp_number,
  referred_by,
  last_seen,
  last_seen_at
) on table public.profiles to authenticated;
grant delete on table public.profiles to authenticated;

-- Defense in depth: the privileged flag is never writable by API roles.
revoke insert (is_admin), update (is_admin)
  on table public.profiles
  from anon, authenticated;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = id);

revoke execute on function public.is_admin(uuid)
  from public, anon, authenticated;

grant execute on function public.is_admin(uuid) to postgres;

commit;
