-- Restore the column-level UPDATE privileges required by the profile upsert.
-- RLS still limits authenticated users to their own profile row.
-- This is intentionally column-scoped so profiles.is_admin remains unwritable.
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
