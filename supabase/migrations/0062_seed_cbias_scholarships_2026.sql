-- Seed the two current CBIAS scholarship listings from the official ERPAAN awards page.
-- Source checked 2026-09-28:
--   https://erpaan.org/awards/
--   https://docs.google.com/document/d/1wjs10h9gjhsVOpKUfqqlwL7S858aMZQj8egAYIo_6sY/edit?tab=t.0
--   https://docs.google.com/document/d/1AZlRXWaowxqJJ6CPxUI_Zx29EXltiKqXkJfchL03g_4/edit?tab=t.0
-- This migration is additive and idempotent. The memorial award and past award
-- holders are not scholarships and are intentionally not inserted into the
-- scholarships catalogue.

do $$
declare
  v_scholarship_id uuid;
begin
  if not exists (
    select 1
    from public.scholarships
    where title = 'CBIAS Undergraduate Scholarship'
      and provider_name = 'Emerging Researchers & Professionals in Ageing-African Network (ERPAAN)'
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
      awards_available,
      competitiveness_notes,
      last_verified_at
    ) values (
      'CBIAS Undergraduate Scholarship',
      'Emerging Researchers & Professionals in Ageing-African Network (ERPAAN)',
      'A 2026 Community-Based Initiative in Ageing Scholarship for final-year students in Nigerian universities who are ready to choose a final-year project. Applicants propose independent research among older adults and should be willing to collaborate with ERPAAN members and participate in research activities that benefit older adults.',
      'NGN 100,000',
      '2026-09-30',
      'https://docs.google.com/forms/d/e/1FAIpQLSdw971PP13HZUYWKtAZhntzlfaSGswqgqM3E_43z2LN4G1oGg/viewform',
      'undergrad',
      'Ageing research / gerontology',
      true,
      'Verified 2026-09-28 against the official ERPAAN awards page and the linked 2026 CBIAS undergraduate call. Eligibility: Nigerian or permanent resident residing in Nigeria; final-year student ready to choose a final-year project; identified faculty supervisor. Required package includes a cover letter, CV, maximum two-page research proposal, one-page budget, supervisor support letter, Head of Department recommendation, and unofficial transcript. The official brief states that the deadline is September 30, 2026 by 8pm Nigerian time. Official source: https://erpaan.org/awards/. Call brief: https://docs.google.com/document/d/1AZlRXWaowxqJJ6CPxUI_Zx29EXltiKqXkJfchL03g_4/edit?tab=t.0',
      'Complete the official Google Form and upload all required documents. The call welcomes quantitative, qualitative, and mixed-method proposals related to ageing and older adults in Nigerian communities. Contact cbias@erpaan.org or info@erpaan.org for questions.',
      null,
      'The official call does not state a fixed number of recipients. Competition is expected because selection uses a double-blinded peer-review process.',
      now()
    ) returning id into v_scholarship_id;

    insert into public.scholarship_rules (scholarship_id, field, operator, value)
    values (v_scholarship_id, 'academic_level', 'eq', '"undergrad"'::jsonb);
  end if;

  if not exists (
    select 1
    from public.scholarships
    where title = 'CBIAS Graduate Scholarship'
      and provider_name = 'Emerging Researchers & Professionals in Ageing-African Network (ERPAAN)'
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
      awards_available,
      competitiveness_notes,
      last_verified_at
    ) values (
      'CBIAS Graduate Scholarship',
      'Emerging Researchers & Professionals in Ageing-African Network (ERPAAN)',
      'A 2026 Community-Based Initiative in Ageing Scholarship for first-year master''s students in Sub-Saharan Africa. Awardees conduct independent research using the e-Delphi methodology to identify long-term ageing research opportunities and prioritize critical research areas and methods relevant to the region.',
      'CAD 250',
      '2026-09-30',
      'https://docs.google.com/forms/d/e/1FAIpQLSdw971PP13HZUYWKtAZhntzlfaSGswqgqM3E_43z2LN4G1oGg/viewform',
      'postgrad',
      'Ageing research / gerontology',
      true,
      'Verified 2026-09-28 against the official ERPAAN awards page and the linked 2026 CBIAS graduate call. Eligibility: citizen or permanent resident of a Sub-Saharan African country; first year of a master''s programme; identified lecturer willing to supervise the final-year project. The award supports research and logistics, with four awards stated in the brief: one for East Africa, one for South Africa, and two for West Africa. Required package includes a cover letter, CV, maximum two-page research proposal, one-page budget, supervisor support letter, and unofficial graduate or undergraduate transcript. The official brief states that the deadline is September 30, 2026 by 8pm Nigerian time. Official source: https://erpaan.org/awards/. Call brief: https://docs.google.com/document/d/1wjs10h9gjhsVOpKUfqqlwL7S858aMZQj8egAYIo_6sY/edit?tab=t.0',
      'Complete the official Google Form and upload all required documents. Applicants must be willing to train in and adopt the e-Delphi methodology, participate in ERPAAN activities, and prepare research outputs and dissemination materials. Contact cbias@erpaan.org or info@erpaan.org for questions.',
      4,
      'The official call states four awards and uses a double-blinded peer-review selection process.',
      now()
    ) returning id into v_scholarship_id;

    insert into public.scholarship_rules (scholarship_id, field, operator, value)
    values (v_scholarship_id, 'academic_level', 'eq', '"postgrad"'::jsonb);
  end if;
end $$;
