-- Verified 2026-10-23 against the official Liberty Career Academy scholarship page,
-- official application pages, the supplied ScholarshipAir listing, and an independent
-- secondary listing. The official page contains stale FAQ dates from prior cycles;
-- the current page body states the 2026 window of 20 October through 3 November 2026.
-- Award amounts are intentionally omitted because the official provider page does not
-- publish them. The ScholarshipAir/secondary listing's amounts are not treated as
-- provider-confirmed facts.
do $migration$
declare
  v_id uuid;
begin
  select id into v_id
  from public.scholarships
  where application_url = 'https://lcaglobal.org/scholarship-application-form/'
     or lower(title) = lower('Liberty Career Academy (LCA) Scholarship Program 2026')
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
      'Liberty Career Academy (LCA) Scholarship Program 2026',
      'Liberty Career Academy (LCA)',
      'The LCA Scholarship Program provides financial support, mentorship, career guidance, and access to LCA’s alumni and partner network for eligible applicants. It has three categories: the Adeola Okungbaye Award for students from single-parent families or who are orphans, the Academic Excellence Award, and the Gifted Hands Award for unemployed applicants pursuing vocational or technical training. Applicants may apply to only one category.',
      'Financial support; category-specific award amount not published on the official provider page',
      '2026-11-03',
      'https://lcaglobal.org/scholarship-application-form/',
      'undergrad',
      null,
      true,
      'Verified 2026-10-23 against the official provider page https://lcaglobal.org/programmes/lca-scholarships/, official academic/Adeola application page https://lcaglobal.org/scholarship-application-form/, official Gifted Hands application page https://lcaglobal.org/gifted-hand-scholarship/, supplied ScholarshipAir listing https://www.scholarshipair.com/s/10262, and independent secondary coverage https://www.afterschoolafrica.com/100124/liberty-career-academy-scholarships/. The current official page body states applications run 20 October–3 November 2026 and close at 11:59 PM WAT. It confirms the three categories, general requirements, and one-category-only rule. The official page does not publish award amounts, so amounts from secondary listings were not copied into the amount field. The official page contains stale FAQ dates from earlier cycles; the current page body and the supplied 2026 listing agree on the 2026 deadline.',
      'Review the category requirements on the official LCA scholarship page. Apply to only one category. For the Academic Excellence Award or Adeola Okungbaye Award, use https://lcaglobal.org/scholarship-application-form/. For the Gifted Hands Award, use https://lcaglobal.org/gifted-hand-scholarship/. Applications are accepted from 20 October 2026 until 3 November 2026 at 11:59 PM WAT. General requirements include verifiable evidence of claims, WASSCE and JAMB results or current CGPA, valid government-issued identification or qualifying family-member support, and an original 500-word personal statement. The provider states that AI-generated personal statements lead to automatic disqualification.',
      '2026-10-20',
      now()
    ) returning id into v_id;
  else
    update public.scholarships set
      title = 'Liberty Career Academy (LCA) Scholarship Program 2026',
      provider_name = 'Liberty Career Academy (LCA)',
      description = 'The LCA Scholarship Program provides financial support, mentorship, career guidance, and access to LCA’s alumni and partner network for eligible applicants. It has three categories: the Adeola Okungbaye Award for students from single-parent families or who are orphans, the Academic Excellence Award, and the Gifted Hands Award for unemployed applicants pursuing vocational or technical training. Applicants may apply to only one category.',
      amount = 'Financial support; category-specific award amount not published on the official provider page',
      deadline = '2026-11-03',
      application_url = 'https://lcaglobal.org/scholarship-application-form/',
      level = 'undergrad',
      discipline = null,
      verified = true,
      research_notes = 'Verified 2026-10-23 against the official provider page https://lcaglobal.org/programmes/lca-scholarships/, official academic/Adeola application page https://lcaglobal.org/scholarship-application-form/, official Gifted Hands application page https://lcaglobal.org/gifted-hand-scholarship/, supplied ScholarshipAir listing https://www.scholarshipair.com/s/10262, and independent secondary coverage https://www.afterschoolafrica.com/100124/liberty-career-academy-scholarships/. The current official page body states applications run 20 October–3 November 2026 and close at 11:59 PM WAT. It confirms the three categories, general requirements, and one-category-only rule. The official page does not publish award amounts, so amounts from secondary listings were not copied into the amount field. The official page contains stale FAQ dates from earlier cycles; the current page body and the supplied 2026 listing agree on the 2026 deadline.',
      how_to_apply = 'Review the category requirements on the official LCA scholarship page. Apply to only one category. For the Academic Excellence Award or Adeola Okungbaye Award, use https://lcaglobal.org/scholarship-application-form/. For the Gifted Hands Award, use https://lcaglobal.org/gifted-hand-scholarship/. Applications are accepted from 20 October 2026 until 3 November 2026 at 11:59 PM WAT. General requirements include verifiable evidence of claims, WASSCE and JAMB results or current CGPA, valid government-issued identification or qualifying family-member support, and an original 500-word personal statement. The provider states that AI-generated personal statements lead to automatic disqualification.',
      opens_at = '2026-10-20',
      last_verified_at = now()
    where id = v_id;
  end if;
end
$migration$;
