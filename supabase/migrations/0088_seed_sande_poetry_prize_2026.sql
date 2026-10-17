-- Publish the verified Sande Poetry Prize 2026 competition.
-- Verified 2026-10-17 against the supplied listing and the organizer's
-- official call for submissions.
do $migration$
begin
  if not exists (
    select 1
    from public.opportunities
    where application_url = 'https://osadolor.com/call-for-submissions-sande-poetry-prize-2026/'
  ) then
    insert into public.opportunities (
      type,
      title,
      provider_name,
      description,
      eligibility_notes,
      duration,
      location,
      compensation,
      discipline,
      deadline,
      opens_at,
      application_url,
      how_to_apply,
      verified,
      research_notes
    ) values (
      'competition',
      'Sande Poetry Prize 2026',
      'Sande Poetry Prize',
      'An annual literary award celebrating contemporary Nigerian poetry. The 2026 edition is the prize''s second edition and offers recognition and financial support for three outstanding poems written by Nigerian poets.',
      'Open to Nigerian writers who were born in Nigeria, are Nigerian nationals or legal residents, or have at least one Nigerian parent. Applicants must be at least 18 years old on 11 October 2026. Submit exactly one original, unpublished poem in English, no longer than 20 lines. Translated poems are welcome, with any sharing of prize money with a translator left to the judging panel.',
      '2026 prize cycle; longlist planned for 28 February 2027, shortlist for 8 March 2027, and winners for 15 March 2027',
      'Nigeria and Nigerian diaspora; email submission',
      '₦800,000 total prize fund for three outstanding poems',
      'Poetry and literature',
      '2026-11-15',
      '2026-10-11',
      'https://osadolor.com/call-for-submissions-sande-poetry-prize-2026/',
      'Prepare one original unpublished poem of no more than 20 lines in a single two-page Word document. Put your full name and biography, date of birth, contact email and phone number, and brief publication history on the first page; put the poem on the second page. Use Times New Roman or Arial at 12 points, single-spaced, in black text. Email the submission to sandepoetryprize@osadolor.com before 15 November 2026. Contact inquiries@osadolor.com for questions.',
      true,
      'Verified 2026-10-17 against the supplied listing https://www.icanstudent.com/sande-poetry-prize-2026-literary-award-for-nigerian-poets/ and the organizer''s official call for submissions https://osadolor.com/call-for-submissions-sande-poetry-prize-2026/. The official call confirms the 2026 submission window of 11 October–15 November 2026, eligibility for Nigerian writers aged 18 or over, the one-poem and 20-line limits, English-language and originality requirements, the two-page Word-document format, submission email, ₦800,000 prize fund for three outstanding poems, judging panel, planned announcement dates, and publication rights for winning and shortlisted poems. The official organizer page does not provide a separate web form; the published application method is email. The supplied Icanstudent page is treated as a secondary discovery source, while the organizer page is the controlling source for publication.'
    );
  end if;
end
$migration$;
