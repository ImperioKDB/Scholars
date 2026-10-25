-- Verified 2026-10-25 against the official provider pages supplied by the user.
-- The Foundation listing is a scholarship; Stories From Nigeria is a writing competition.
-- No unsupported eligibility rules are added: the catalog stores the official notes
-- and leaves nuanced circumstances for the provider's own application review.
do $migration$
declare
  v_id uuid;
begin
  -- Anthony Udokwu's Foundation-Yahweh 2027/2028 University Scholarship.
  select id into v_id
  from public.scholarships
  where application_url = 'https://anthonyudokwufoundationyahweh.co.uk/2028-Scholarship/'
     or lower(title) = lower('Anthony Udokwu''s Foundation-Yahweh 2027/2028 University Scholarship')
  order by created_at desc
  limit 1;

  if v_id is null then
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
      opens_at,
      last_verified_at
    ) values (
      'Anthony Udokwu''s Foundation-Yahweh 2027/2028 University Scholarship',
      'Anthony Udokwu''s Foundation-Yahweh',
      'A university scholarship programme for eligible students whose circumstances meet the Foundation''s published support routes. The Foundation states that applications are assessed individually and that eligibility does not guarantee shortlisting or an award.',
      'Full or partial university scholarship; the award amount is not published for this cycle',
      '2027-02-28',
      'https://anthonyudokwufoundationyahweh.co.uk/2028-Scholarship/',
      'undergrad',
      null,
      true,
      'Verified 2026-10-25 against the official scholarship page https://anthonyudokwufoundationyahweh.co.uk/2028-Scholarship/, official Foundation homepage https://anthonyudokwufoundationyahweh.co.uk/, and official process page https://www.anthonyudokwufoundationyahweh.co.uk/Our-Process/. The official homepage states applications are open for the 2027/2028 University Scholarship and close on 28 February 2027. The official scholarship page says applicants must meet at least one published route: disability, qualifying orphanhood or parental abandonment, or serious extenuating circumstances; university enrollment alone is not sufficient. The official process page describes institutional reference verification, admission and JAMB letter uploads, and individual assessment. The official pages do not publish a fixed award amount for this cycle, so no amount is asserted.',
      'Review the Foundation''s eligibility routes and apply through the official 2027/2028 scholarship page before 28 February 2027. Applicants should be prepared to provide university details, expected graduation year, matriculation or registration number, admission and JAMB admission letters, and a reference from a senior institutional official using an official university email. Do not upload medical, orphanhood or abuse-related evidence at the initial scholarship application stage unless the Foundation later requests it. After applying, keep the reference and use the Foundation Records Portal to monitor the application.',
      null,
      now()
    ) returning id into v_id;
  else
    update public.scholarships set
      title = 'Anthony Udokwu''s Foundation-Yahweh 2027/2028 University Scholarship',
      provider_name = 'Anthony Udokwu''s Foundation-Yahweh',
      description = 'A university scholarship programme for eligible students whose circumstances meet the Foundation''s published support routes. The Foundation states that applications are assessed individually and that eligibility does not guarantee shortlisting or an award.',
      amount = 'Full or partial university scholarship; the award amount is not published for this cycle',
      deadline = '2027-02-28',
      application_url = 'https://anthonyudokwufoundationyahweh.co.uk/2028-Scholarship/',
      level = 'undergrad',
      discipline = null,
      verified = true,
      research_notes = 'Verified 2026-10-25 against the official scholarship page https://anthonyudokwufoundationyahweh.co.uk/2028-Scholarship/, official Foundation homepage https://anthonyudokwufoundationyahweh.co.uk/, and official process page https://www.anthonyudokwufoundationyahweh.co.uk/Our-Process/. The official homepage states applications are open for the 2027/2028 University Scholarship and close on 28 February 2027. The official scholarship page says applicants must meet at least one published route: disability, qualifying orphanhood or parental abandonment, or serious extenuating circumstances; university enrollment alone is not sufficient. The official process page describes institutional reference verification, admission and JAMB letter uploads, and individual assessment. The official pages do not publish a fixed award amount for this cycle, so no amount is asserted.',
      how_to_apply = 'Review the Foundation''s eligibility routes and apply through the official 2027/2028 scholarship page before 28 February 2027. Applicants should be prepared to provide university details, expected graduation year, matriculation or registration number, admission and JAMB admission letters, and a reference from a senior institutional official using an official university email. Do not upload medical, orphanhood or abuse-related evidence at the initial scholarship application stage unless the Foundation later requests it. After applying, keep the reference and use the Foundation Records Portal to monitor the application.',
      opens_at = null,
      last_verified_at = now()
    where id = v_id;
  end if;

  -- Stories From Nigeria Annual Writing Competition 2026.
  if not exists (
    select 1
    from public.opportunities
    where application_url = 'https://storiesfromnigeria.org/submissions/'
       or lower(title) = lower('Stories From Nigeria Annual Writing Competition 2026')
    limit 1
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
      'Stories From Nigeria Annual Writing Competition 2026',
      'Stories From Nigeria',
      'The third annual writing competition inviting Nigerian voices to tell stories about contemporary Nigeria through one of five themes: Justice, Healthcare, Social Reform, Education, or Entrepreneurship.',
      'Open to Nigerian citizens aged 16–35 living in Nigeria or in the diaspora. Secondary and tertiary students, early-career professionals, and emerging writers are welcome. Entries may be short stories, poetry, or essays of no more than 750 words. Work must be unpublished and submitted in English; indigenous-language submissions are encouraged when accompanied by an English translation.',
      'Submissions open 21 October 2026 and close 12 November 2026; judging ends 30 November 2026 and winners are announced 7 December 2026.',
      'Online; Nigeria and Nigerian diaspora',
      '₦450,000 total prizes: ₦200,000 first place, ₦150,000 second place, and ₦100,000 third place. Each winner also receives an interview feature on Stories From Nigeria.',
      'Writing, creative arts, journalism, and storytelling',
      '2026-11-12',
      '2026-10-21',
      'https://storiesfromnigeria.org/submissions/',
      'Choose one of the five official themes and submit an original unpublished short story, poem, or essay of no more than 750 words through the official Stories From Nigeria submissions page before 12 November 2026. Follow the official formatting instructions: Arial, size 11, 1.5 line spacing. Submit in English, or include an English translation with an indigenous-language entry.',
      true,
      'Verified 2026-10-25 against the official competition page https://storiesfromnigeria.org/competition/ and official submission page https://storiesfromnigeria.org/submissions/. The competition page confirms the third annual 2026 edition, five themes, Nigerian citizenship and age 16–35 eligibility, Nigeria or diaspora residence, the 750-word maximum, unpublished-work requirement, 21 October opening date, 12 November closing date, ₦450,000 total prize pool, individual prize amounts of ₦200,000/₦150,000/₦100,000, and winner interview features. The submission page confirms that entrants choose one theme, submit 750 words or less, upload a Word document, and that entries close 12 November 2026.'
    );
  end if;
end
$migration$;
