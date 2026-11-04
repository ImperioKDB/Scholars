-- Publish the verified COAS Literary Competitions 2027 opportunity.
-- The competition is an opportunity, not a scholarship: it has primary,
-- secondary, and tertiary categories with separate cash prizes.
-- The supplied official domain currently exposes stale year labels on the
-- two form routes, so the competition landing page and official Nigerian
-- Army announcement are the controlling sources for the 2027 record.
do $migration$
declare
  v_id uuid;
begin
  select id into v_id
  from public.opportunities
  where application_url = 'https://dcma.army.mil.ng/competition'
     or lower(title) = lower('COAS Literary Competitions 2027')
  order by created_at desc
  limit 1;

  if v_id is null then
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
      'COAS Literary Competitions 2027',
      'Department of Civil-Military Affairs, Nigerian Army',
      'The 4th edition of the Chief of Army Staff Literary Competitions invites young Nigerians to express ideas and creative talent through essay, art, and poetry competitions on the theme “Building Mutual Trust Between the Nigerian Army and the Citizens as a Foundation for National Security.”',
      'Open to Nigerian children and youth in primary school (ages 5–11), secondary school (ages 12–17), and tertiary institutions (ages 18–24). Essay, art, and poetry entries must be original. Primary and secondary essays must not exceed 2,000 words; tertiary essays must be 3,000–5,000 words; poetry is limited to 200 words and must be in English; art entries must be original paintings or drawings with a short caption.',
      'Online entry submission; initial shortlisting followed by a virtual interaction with assessors before final selection. Winners receive certificates and are presented with prizes at a dedicated event.',
      'Nigeria; online submission through the Department of Civil-Military Affairs',
      'Primary: ₦1,000,000 first prize, ₦750,000 second prize, ₦500,000 third prize. Secondary: ₦1,500,000 first prize, ₦1,200,000 second prize, ₦750,000 third prize. Tertiary: ₦2,000,000 first prize, ₦1,500,000 second prize, ₦1,000,000 third prize. Certificates are also awarded.',
      'Writing, essay, poetry, art, and creative expression',
      '2027-05-31',
      '2026-11-01',
      'https://dcma.army.mil.ng/competition',
      'Read the official competition guidelines at https://dcma.army.mil.ng/competition. Primary and secondary applicants use https://dcma.army.mil.ng/dcma/ps-literary-competition/new; tertiary applicants use https://dcma.army.mil.ng/dcma/tertiary-literary-competition/new. Complete the online form, print it, obtain the required school endorsement and stamp, scan it, and upload it with the original essay, artwork, or poem before 31 May 2027. Confirm the applicable year and current form instructions on the official competition page before submitting because the live form pages currently display older year labels.',
      true,
      'Verified 2026-11-04 against the DCMA competition page mirrored at https://dcma.vercel.app/competition, the official Nigerian Army announcement at https://www.facebook.com/NigerianArmy/posts/applications-open-for-the-4th-edition-of-the-chief-of-army-staff-coas-literary-c/1446125634308808/, and the supplied official domain https://dcma.army.mil.ng/. The competition page and official Nigerian Army announcement agree on the 4th edition, 2027 title, theme, Nigerian age-group eligibility, essay/art/poetry categories, 1 November 2026 opening date, 31 May 2027 closing date, and prize amounts. The official primary/secondary form route is reachable but displays “2026”; the official tertiary form route is reachable but displays “2025”. Those stale labels are recorded as a verification caveat rather than treated as evidence of a separate current cycle. No entry was submitted and no personal data was entered.'
    ) returning id into v_id;
  else
    update public.opportunities set
      type = 'competition',
      title = 'COAS Literary Competitions 2027',
      provider_name = 'Department of Civil-Military Affairs, Nigerian Army',
      description = 'The 4th edition of the Chief of Army Staff Literary Competitions invites young Nigerians to express ideas and creative talent through essay, art, and poetry competitions on the theme “Building Mutual Trust Between the Nigerian Army and the Citizens as a Foundation for National Security.”',
      eligibility_notes = 'Open to Nigerian children and youth in primary school (ages 5–11), secondary school (ages 12–17), and tertiary institutions (ages 18–24). Essay, art, and poetry entries must be original. Primary and secondary essays must not exceed 2,000 words; tertiary essays must be 3,000–5,000 words; poetry is limited to 200 words and must be in English; art entries must be original paintings or drawings with a short caption.',
      duration = 'Online entry submission; initial shortlisting followed by a virtual interaction with assessors before final selection. Winners receive certificates and are presented with prizes at a dedicated event.',
      location = 'Nigeria; online submission through the Department of Civil-Military Affairs',
      compensation = 'Primary: ₦1,000,000 first prize, ₦750,000 second prize, ₦500,000 third prize. Secondary: ₦1,500,000 first prize, ₦1,200,000 second prize, ₦750,000 third prize. Tertiary: ₦2,000,000 first prize, ₦1,500,000 second prize, ₦1,000,000 third prize. Certificates are also awarded.',
      discipline = 'Writing, essay, poetry, art, and creative expression',
      deadline = '2027-05-31',
      opens_at = '2026-11-01',
      application_url = 'https://dcma.army.mil.ng/competition',
      how_to_apply = 'Read the official competition guidelines at https://dcma.army.mil.ng/competition. Primary and secondary applicants use https://dcma.army.mil.ng/dcma/ps-literary-competition/new; tertiary applicants use https://dcma.army.mil.ng/dcma/tertiary-literary-competition/new. Complete the online form, print it, obtain the required school endorsement and stamp, scan it, and upload it with the original essay, artwork, or poem before 31 May 2027. Confirm the applicable year and current form instructions on the official competition page before submitting because the live form pages currently display older year labels.',
      verified = true,
      research_notes = 'Verified 2026-11-04 against the DCMA competition page mirrored at https://dcma.vercel.app/competition, the official Nigerian Army announcement at https://www.facebook.com/NigerianArmy/posts/applications-open-for-the-4th-edition-of-the-chief-of-army-staff-coas-literary-c/1446125634308808/, and the supplied official domain https://dcma.army.mil.ng/. The competition page and official Nigerian Army announcement agree on the 4th edition, 2027 title, theme, Nigerian age-group eligibility, essay/art/poetry categories, 1 November 2026 opening date, 31 May 2027 closing date, and prize amounts. The official primary/secondary form route is reachable but displays “2026”; the official tertiary form route is reachable but displays “2025”. Those stale labels are recorded as a verification caveat rather than treated as evidence of a separate current cycle. No entry was submitted and no personal data was entered.'
    where id = v_id;
  end if;
end
$migration$;
