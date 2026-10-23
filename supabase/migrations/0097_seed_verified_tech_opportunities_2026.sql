-- Verified 2026-10-23 against official program sources.
-- Closed or date-unverified cycles are intentionally not published as open:
-- Outreachy, GSoC, and Season of KDE are omitted for that reason.
do $migration$
begin
  if not exists (select 1 from public.opportunities where application_url = 'https://mentorship.lfx.linuxfoundation.org/' and title = 'Linux Foundation LFX Mentorship' limit 1) then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'mentorship',
      'Linux Foundation LFX Mentorship',
      'Linux Foundation',
      'Recurring open-source software mentorship for students and experienced programmers. Projects are offered by participating open-source communities and may be full-time or part-time depending on the project.',
      'Eligibility and prerequisites are project-specific. Applicants create an LFX profile, review projects listed under Accepting Applications, complete any required skill evaluation or prerequisite task, and submit the project application and requested materials. Nigerian applicants are not generally excluded, but each project may have its own restrictions.',
      'Typically 12-week full-time or 24-week part-time mentorship; project terms vary',
      'Remote; project-dependent',
      'Project-dependent educational stipend. Official Linux Foundation guidance states that programs starting on or after 1 July 2026 use a country-adjusted stipend model; the exact amount and payment conditions depend on the program and project.',
      'Open source',
      null,
      null,
      'https://mentorship.lfx.linuxfoundation.org/',
      'Open the official LFX Mentorship portal and filter for projects marked Accepting Applications. Review the individual project requirements, complete any prerequisite task, and submit the application through that project page. Do not assume that every listed mentorship is currently open.',
      true,
      'Verified 2026-10-23 against the official LFX Mentorship portal https://mentorship.lfx.linuxfoundation.org/, official mentee guidance https://docs.linuxfoundation.org/lfx/mentorship/mentees, official timelines https://docs.linuxfoundation.org/lfx/mentorship/mentorship-program-timelines, and official stipend guidance https://docs.linuxfoundation.org/lfx/mentorship/mentee-stipends/total-stipend-amount. The program is recurring, but the live portal is dynamic and no single program-wide deadline was verified. This listing intentionally has no deadline and tells students to check the current Accepting Applications filter.'
    );
  end if;

  if not exists (select 1 from public.opportunities where application_url = 'https://mentorship.lfx.linuxfoundation.org/' and title = 'CNCF Mentoring / LFX Mentorship' limit 1) then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'mentorship',
      'CNCF Mentoring / LFX Mentorship',
      'Cloud Native Computing Foundation and Linux Foundation',
      'Project-based open-source mentorship delivered through the LFX Mentorship platform. Participants work with CNCF projects and mentors on defined technical or community contributions.',
      'Applicants apply to a specific CNCF project and are assessed on project fit, technical preparation, collaboration, and any project-specific prerequisites. Nigerian applicants may apply where the individual project permits; some projects can have geographic or enrollment restrictions.',
      'Term and workload are project-specific; recurring LFX terms commonly run for several weeks or months',
      'Remote; CNCF project-dependent',
      'Stipend may be available under the LFX program and is subject to the current stipend policy, project, country adjustment, and satisfactory progress. Amount is not stated here because no Nigeria-specific payout was confirmed for this listing.',
      'Cloud computing, open source',
      null,
      null,
      'https://mentorship.lfx.linuxfoundation.org/',
      'Monitor the official LFX Mentorship portal and CNCF mentoring announcements. Apply only when a suitable CNCF project is marked open, then follow that project’s stated prerequisites, application steps, and term requirements.',
      true,
      'Verified 2026-10-23 against the official CNCF mentoring page https://www.cncf.io/mentoring/, official LFX portal https://mentorship.lfx.linuxfoundation.org/, CNCF mentoring repository https://github.com/cncf/mentoring/blob/main/programs/lfx-mentorship/README.md, and official Linux Foundation stipend guidance https://docs.linuxfoundation.org/lfx/mentorship/mentee-stipends. The 2026 Term 3 application window had closed by the verification date, so this is published as a recurring watchlist opportunity rather than an open current application.'
    );
  end if;

  if not exists (select 1 from public.opportunities where application_url = 'https://fellowship.mlh.io/apply' and title = 'MLH Fellowship' limit 1) then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'fellowship',
      'MLH Fellowship',
      'Major League Hacking (MLH)',
      'A fully remote, 12-week educational fellowship with software engineering and open-source tracks. Fellows work on projects with peers and mentors and build experience contributing to real software communities.',
      'General/open tracks require applicants to be at least 18, communicate proficiently in English, commit at least 20 hours weekly for 12 weeks, have suitable internet for video calls, demonstrate programming ability, and have participated in an MLH Hackathon or Global Hack Week event. Nigerian applicants may apply to the general/open tracks if they meet the requirements. Production Engineering has a separate North America eligibility restriction.',
      '12 weeks; batch dates vary',
      'Remote',
      'Educational stipend or university credit may be offered depending on the program; official MLH materials do not publish one universal stipend amount.',
      'Software engineering, open source, DevOps',
      null,
      null,
      'https://fellowship.mlh.io/apply',
      'Check the official MLH application page for the next available batch. Target the Software Engineering or Open Source tracks if eligible, and complete an MLH Hackathon or Global Hack Week event if required. The Fall 2026 deadline shown by the official application page had passed at verification time.',
      true,
      'Verified 2026-10-23 against official MLH pages https://fellowship.mlh.io/, https://fellowship.mlh.io/apply, https://fellowship.mlh.io/programs/software-engineering, https://fellowship.mlh.io/programs/open-source, and https://fellowship.mlh.io/faq. The official application page showed a passed Fall 2026 deadline, while official program pages describe recurring batches. This listing intentionally has no deadline and does not claim a current open batch or fixed stipend amount.'
    );
  end if;

  if not exists (select 1 from public.opportunities where application_url = 'https://app.advocu.com/gdg/join' and title = 'Google Developer Groups on Campus' limit 1) then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'training',
      'Google Developer Groups on Campus',
      'Google Developer Groups community',
      'A Google-supported developer community and campus-leadership pathway for university student developers. Participants can join or help build a campus developer community and connect with local or online developer groups.',
      'The campus route is intended for university student developers. Google’s official community information welcomes beginners and professionals for general GDG participation. The official material reviewed does not publish a Nigeria-specific restriction or a complete campus-lead checklist, so applicants should follow the portal’s current form and approval process.',
      'Community participation and chapter leadership; duration varies',
      'Campus-based or online; local chapter dependent',
      'No stipend or guaranteed financial compensation stated in the official sources reviewed.',
      'Software development, cloud, data, AI',
      null,
      null,
      'https://app.advocu.com/gdg/join',
      'Use the official GDG on Campus portal to sign up, verify the account, and complete the application form. Students who are not applying to lead a campus group can join a local or online GDG through the official Google Developers community page.',
      true,
      'Verified 2026-10-23 against Google’s official community page https://developers.google.com/community, GDG groups page https://developers.google.com/community/gdg/groups, and the linked official sign-up portal https://app.advocu.com/gdg/join. The official pages show an active recurring community route but do not publish a dated 2026 cycle, deadline, or stipend. This is classified as a training/community opportunity, not paid employment.'
    );
  end if;
end
$migration$;
