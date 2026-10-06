-- Publish the Decagon Undergraduate Honors Program after checking the
-- provider's official student page and application page on 2026-10-06.
-- The official page does not publish a current closing date, so deadline
-- remains null rather than using a guessed date.
do $$
declare
  v_scholarship_id uuid;
begin
  if not exists (
    select 1
    from public.scholarships
    where application_url = 'https://www.decagonfoundation.org/apply'
  ) then
    insert into public.scholarships (
      title,
      provider_name,
      description,
      amount,
      deadline,
      application_url,
      level,
      discipline,
      verified,
      research_notes,
      how_to_apply,
      last_verified_at,
      slug
    ) values (
      'Decagon Undergraduate Honors Program',
      'Decagon Foundation',
      'A fully funded undergraduate programme for Nigerian students whose JAMB score is 250 or above and whose financial circumstances make university tuition unaffordable. The programme includes tuition funding, admission support, leadership training, career training, mentorship, community membership, and access to work opportunities.',
      '100% tuition covered for up to 4 years; additional programme benefits included',
      null,
      'https://www.decagonfoundation.org/apply',
      'undergrad',
      null,
      true,
      'Verified 2026-10-06 against the provider''s official student page https://www.decagonfoundation.org/for-students?utm_source=ScholarsWorldNG and its linked application page https://www.decagonfoundation.org/apply. The official page states that Nigerian citizenship is required, applicants need a JAMB/UTME score of 250 or above, financial need, and character/commitment, and candidates must be seeking admission to a partner university. It describes 100% tuition coverage for four years, with funding paid directly to the university each semester against verified enrolment and satisfactory academic progress. The application process asks for JAMB score, WAEC results, and a short personal statement. No current application deadline or individual cash award is published on the checked official page, so deadline remains null and the amount is recorded as tuition coverage rather than a guessed naira value. Official contact: folashadem@decagonfoundation.org.',
      'Apply through the official Decagon application page. Prepare your JAMB/UTME result, WAEC results, and a short personal statement. Applicants should confirm their Nigerian citizenship, financial need, and readiness to attend one of the programme''s partner universities. The provider''s page does not publish a current deadline; confirm that the application form is accepting responses before submitting.',
      now(),
      'decagon-undergraduate-honors-program'
    ) returning id into v_scholarship_id;

    insert into public.scholarship_rules (scholarship_id, field, operator, value)
    values
      (v_scholarship_id, 'nationality', 'eq', '"Nigerian"'::jsonb),
      (v_scholarship_id, 'financial_need', 'eq', 'true'::jsonb),
      (v_scholarship_id, 'jamb_score', 'gte', '250'::jsonb);
  end if;
end $$;
