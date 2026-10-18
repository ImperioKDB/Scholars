-- Publish the verified African Union Theme of the Year 2027 logo competition.
-- Verified 2026-10-18 against the AU call page, terms of reference,
-- and official registration form.
do $migration$
begin
  if not exists (
    select 1
    from public.opportunities
    where application_url = 'https://accreditation.au.int/en/form/data-form-media'
       or lower(title) = lower('AU Theme of the Year 2027 Logo Competition')
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
      'AU Theme of the Year 2027 Logo Competition',
      'African Union Commission',
      'A continental logo and visual-identity competition inviting young African creatives to design the official visual identity for the 2027 AU Theme: “AU at the Dawn of its 25th Anniversary: Leveraging the Full Potential of SAATM and New Technologies for Continental Integration.”',
      'Open to citizens of all African Union Member States aged 18–24 on the submission deadline. Entries must be individual submissions; one entry per applicant. Students, designers, artists, digital creatives, and innovators may apply without formal qualifications. Evaluation-process members, AU personnel, contractors, and their immediate family members are ineligible. Generative AI may not be used; the work must be original and created specifically for this competition.',
      'Submission closes 23 October 2026 at 23:59 EAT (UTC+3). The selected logo will serve as the visual identity of the AU Theme throughout 2027.',
      'Online; open across African Union Member States',
      'USD 5,000 first place; USD 2,000 second place; USD 1,000 third place. Certificates, official recognition, training opportunities, and an opportunity for the winner to participate in the AU Summit are also offered.',
      'Graphic design, visual arts, digital creativity, and branding',
      '2026-10-23',
      '2026-09-24',
      'https://accreditation.au.int/en/form/data-form-media',
      'Review the official call and terms of reference, then complete the AU registration form before 23 October 2026 at 23:59 EAT. Submit the completed application form, proof of nationality and age, a presentation PDF containing the primary logo, colour, monochrome and reversed versions, colour palette and typography direction, and three mock-ups; a PNG or JPEG preview at least 3,000 pixels wide; a concept note of no more than 500 words; and the signed originality, intellectual-property and AI declaration. Entries must be original, must not use generative AI or third-party material, and must be submitted individually. Retain the automated acknowledgement after submission.',
      true,
      'Verified 2026-10-18 against the African Union official call page https://www.au.int/en/newsevents/20260829/call-entries-calling-young-african-creatives-logo-competition-au-theme-year, official terms of reference page https://au.int/en/documents/20260924/tor-continental-logo-and-visual-identity-competition, and official registration form https://accreditation.au.int/en/form/data-form-media. The call states the submission deadline is 23 October 2026 at 23:59 EAT (UTC+3), eligibility is AU Member State citizenship and age 18–24, and awards are USD 5,000, USD 2,000, and USD 1,000 for first, second, and third place. The official form confirms the submission deadline and required application fields and uploads. The call and form prohibit generative-AI-created or substantially enhanced logos and require original work.'
    );
  end if;
end
$migration$;
