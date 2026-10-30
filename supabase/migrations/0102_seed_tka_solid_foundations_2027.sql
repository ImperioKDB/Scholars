-- Publish the verified TKA Solid Foundations 2027 Nigerian College/University Scholarship.
-- The official provider page contains the public application form. The supplied
-- Google Form is sign-in restricted and is not linked from the provider page,
-- so it is preserved in research_notes but is not used as the applicant URL.
do $migration$
declare
  v_scholarship_id uuid;
begin
  select id into v_scholarship_id
  from public.scholarships
  where application_url = 'https://tkasolidfoundations.org/scholarships/2027-nigerian-scholarship'
     or lower(title) = lower('TKA Solid Foundations 2027 Nigerian College/University Scholarship')
  order by created_at desc
  limit 1;

  if v_scholarship_id is null then
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
      'TKA Solid Foundations 2027 Nigerian College/University Scholarship',
      'TKA Solid Foundations',
      'A programme offering 50 scholarships to students seeking admission to Nigerian public universities and polytechnics for the 2027 academic session. Support includes tuition or school fees, textbooks and stationery, and bursary assistance. Priority is given to students from low-income families.',
      'Tuition/school fees, textbooks, stationery, and bursary support; individual award value not specified',
      '2026-12-20',
      'https://tkasolidfoundations.org/scholarships/2027-nigerian-scholarship',
      'undergrad',
      null,
      true,
      'Verified 2026-10-30 against the official TKA Solid Foundations scholarship page https://tkasolidfoundations.org/scholarships/2027-nigerian-scholarship and the organisation homepage https://tkasolidfoundations.org/. The official page states that 50 scholarships are available for students seeking admission to Nigerian public universities and polytechnics in the 2027 academic session; applications opened 2026-10-01 and close 2026-12-20 at 11:59 PM Nigeria time. WAEC or equivalent results from 2024–2027 are accepted and awaiting results are allowed. Applicants should be preparing for JAMB/UTME and the 2027 admission process, and the provider will administer a screening test. The official page states that priority is given to low-income families, support includes tuition/school fees, textbooks and stationery, and bursary support, and the screening is scheduled for 2027-03-13 at 9:00 AM Nigeria time. The official page hosts its own public application form and says no account, login, or file upload is required. The supplied Google Form https://docs.google.com/forms/d/e/1FAIpQLSdjsitKhRAF3Mmw8JUUxzp9cKaCfju_J4PPl0usAV5mV43bNQ/viewform required Google sign-in during verification and was not linked from the official page, so it was not used as the public application URL. No fixed individual award amount or nationality rule was added because neither was clearly stated on the official provider page.',
      'Open the official TKA Solid Foundations scholarship page and complete every required field in the embedded application form before 20 December 2026 at 11:59 PM Nigeria time. No applicant account, login, or document upload is required. Keep the application reference number after submission; confirmation and updates are sent to the email address provided. Applicants should be prepared for the TKA screening test in Lagos State on 13 March 2027 at 9:00 AM Nigeria time if selected.',
      '2026-10-01',
      now()
    ) returning id into v_scholarship_id;
  else
    update public.scholarships set
      title = 'TKA Solid Foundations 2027 Nigerian College/University Scholarship',
      provider_name = 'TKA Solid Foundations',
      description = 'A programme offering 50 scholarships to students seeking admission to Nigerian public universities and polytechnics for the 2027 academic session. Support includes tuition or school fees, textbooks and stationery, and bursary assistance. Priority is given to students from low-income families.',
      amount = 'Tuition/school fees, textbooks, stationery, and bursary support; individual award value not specified',
      deadline = '2026-12-20',
      application_url = 'https://tkasolidfoundations.org/scholarships/2027-nigerian-scholarship',
      level = 'undergrad',
      discipline = null,
      verified = true,
      research_notes = 'Verified 2026-10-30 against the official TKA Solid Foundations scholarship page https://tkasolidfoundations.org/scholarships/2027-nigerian-scholarship and the organisation homepage https://tkasolidfoundations.org/. The official page states that 50 scholarships are available for students seeking admission to Nigerian public universities and polytechnics in the 2027 academic session; applications opened 2026-10-01 and close 2026-12-20 at 11:59 PM Nigeria time. WAEC or equivalent results from 2024–2027 are accepted and awaiting results are allowed. Applicants should be preparing for JAMB/UTME and the 2027 admission process, and the provider will administer a screening test. The official page states that priority is given to low-income families, support includes tuition/school fees, textbooks and stationery, and bursary support, and the screening is scheduled for 2027-03-13 at 9:00 AM Nigeria time. The official page hosts its own public application form and says no account, login, or file upload is required. The supplied Google Form https://docs.google.com/forms/d/e/1FAIpQLSdjsitKhRAF3Mmw8JUUxzp9cKaCfju_J4PPl0usAV5mV43bNQ/viewform required Google sign-in during verification and was not linked from the official page, so it was not used as the public application URL. No fixed individual award amount or nationality rule was added because neither was clearly stated on the official provider page.',
      how_to_apply = 'Open the official TKA Solid Foundations scholarship page and complete every required field in the embedded application form before 20 December 2026 at 11:59 PM Nigeria time. No applicant account, login, or document upload is required. Keep the application reference number after submission; confirmation and updates are sent to the email address provided. Applicants should be prepared for the TKA screening test in Lagos State on 13 March 2027 at 9:00 AM Nigeria time if selected.',
      opens_at = '2026-10-01',
      last_verified_at = now()
    where id = v_scholarship_id;
  end if;
end
$migration$;
