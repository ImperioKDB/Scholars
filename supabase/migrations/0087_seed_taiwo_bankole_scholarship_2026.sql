-- Publish the Taiwo Bankole Prize 2026 after checking the official
-- programme homepage, biography page, instructions page, and linked form
-- on 2026-10-16. The official pages do not state an individual award amount.
do $migration$
begin
  if not exists (
    select 1
    from public.scholarships
    where application_url = 'https://taiwobankole.com/application-form/'
       or lower(provider_name) = 'taiwo bankole prize'
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
      awards_available
    ) values (
      'Taiwo Bankole Prize 2026',
      'Taiwo Bankole Prize',
      'Annual scholarship support for young people from low-income families who live in Ajegunle and have secured admission to a public university in Nigeria to study a Science, Technology, Engineering, Mathematics, or Law course. The official site says at least two young people are awarded each year in honour of Taiwo Bankole Ogunyemi.',
      'Scholarship support; individual award amount not stated on the checked official pages',
      '2026-11-06',
      'https://taiwobankole.com/application-form/',
      'undergrad',
      'Science, Technology, Engineering, Mathematics (STEM), or Law',
      true,
      'Verified 2026-10-16 against the official programme homepage https://taiwobankole.com/, the official biography page https://taiwobankole.com/about/, the official instructions page https://taiwobankole.com/application/, and the linked official form https://taiwobankole.com/application-form/. The homepage states the applicant must be 17–25, from a low-income family, have secured admission into a public university in Nigeria for a STEM or Law course, and be resident in Ajegunle. The instructions page states the deadline is 2026-11-06 at 11:59 PM WAT and requires an SSCE certificate, JAMB result, admission letter, identification document, and two recommendation letters, including one from a secondary-school teacher or principal and one Ajegunle community stakeholder. The official pages do not state an individual award amount. Paradigm Initiative is identified on the official site as the organisation opening the call for applications.',
      'Review the eligibility requirements and submit the official application form before 11:59 PM WAT on 6 November 2026. Prepare an SSCE certificate, JAMB result, admission letter, identification document, and two recommendation letters: one from a secondary-school teacher or principal and one Ajegunle community stakeholder. Apply only through the official Taiwo Bankole form and do not pay an intermediary.',
      now(),
      2
    );
  end if;
end
$migration$;
