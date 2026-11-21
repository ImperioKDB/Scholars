-- LONG Empowerment Foundation Vocational Fellowship 2026.
-- Verified against the provider page on 2026-11-21. The application window is
-- inconsistent across official pages and no confirmed closing date is given;
-- keep the public deadline blank and retain the caveat in user-facing guidance.
do $seed$
declare
  v_id uuid;
begin
  select id into v_id
  from public.opportunities
  where application_url = 'https://docs.google.com/forms/d/e/1FAIpQLSelf9ie4Hk4EqT53YxN-yM318IGgWP7Z5UNqh4J7pCEoJAGqg/viewform'
     or lower(title) = lower('LONG Empowerment Foundation Vocational Fellowship 2026')
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'training',
      'LONG Empowerment Foundation Vocational Fellowship 2026',
      'LONG Empowerment Foundation',
      'Six-month, full-time vocational training in Software Development, Fashion Design, or Catering and Event Planning. LONG describes the fellowship as a fully funded training scholarship and outlines training, mentorship, and enterprise setup support. The official page does not clearly confirm a monthly stipend, accommodation, or a guaranteed grant amount, so those benefits are not promised here.',
      'The official fellowship page lists Nigerian citizens residing in Nigeria, ages 16–26, from families with annual income below ₦3 million; applicants must have completed at least Primary 5, must not be enrolled in or have completed tertiary education, and must commit at least 40 hours weekly. Applicants must live in a state covered by LONG’s training partners for this cohort. Track-specific criteria apply. LONG’s homepage gives a different general income threshold, so confirm the current cohort-specific requirement on the application form.',
      'Six months; full-time commitment of at least 40 hours per week',
      'Nigeria; only states covered by LONG training partners for this cohort',
      null,
      'Software Development, Fashion Design, Catering and Event Planning',
      null,
      null,
      'https://docs.google.com/forms/d/e/1FAIpQLSelf9ie4Hk4EqT53YxN-yM318IGgWP7Z5UNqh4J7pCEoJAGqg/viewform',
      'Apply through the official LONG fellowship page at https://longempowerment.org/fellowship. That page labels the 2026 cycle open and links to this form. The form displayed a Google sign-in screen during review, so sign-in may be required and response acceptance could not be independently confirmed. LONG’s alternate vocational-fellowship page still says “Application Opening Soon” and includes an outdated 2025 timeline. ScholarshipAir and ScholarshipHub report a 30 November 2026 deadline, but LONG’s official pages do not clearly confirm a closing date; the deadline is therefore left blank. Apply promptly and confirm the form is accepting responses with LONG if needed.',
      true,
      'Verified 2026-11-21. Primary source: LONG official fellowship page https://longempowerment.org/fellowship, which says the 2026 cycle is open and links the application form; it lists six-month Software Development, Fashion Design, and Catering/Event Planning tracks, Nigerian citizenship/residency, ages 16–26, family income below ₦3 million, Primary 5 completion, no tertiary education, a 40-hour weekly commitment, and cohort-specific partner states. The form https://docs.google.com/forms/d/e/1FAIpQLSelf9ie4Hk4EqT53YxN-yM318IGgWP7Z5UNqh4J7pCEoJAGqg/viewform showed a Google sign-in screen, so active response acceptance was not independently visible. LONG’s alternate official page https://longempowerment.org/vocational-fellowship says “Application Opening Soon” and links a reminder form, while also containing older 2025 timeline copy; LONG’s homepage https://longempowerment.org/ gives a different general household-income threshold (<₦5 million). ScholarshipAir https://www.scholarshipair.com/s/10323 and ScholarshipHub https://scholarshiphub.ng/long-empowerment/ report a 30 November 2026 deadline, which is not clearly confirmed on LONG’s official pages, so the database deadline is null. Official page copy mentions post-training benefits but includes placeholder text; stipend, accommodation, and grant amounts are not included as verified benefits.'
    ) returning id into v_id;
  end if;
end
$seed$;
