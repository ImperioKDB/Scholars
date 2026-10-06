-- Correct the Decagon Undergraduate Honors Program deadline after the
-- scholarship cycle date was confirmed as 15 October 2026 during verification.
update public.scholarships
set
  deadline = '2026-10-15',
  research_notes = concat(
    coalesce(research_notes, ''),
    E'\n\nDeadline correction verified 2026-10-06: the current application cycle closes 15 October 2026. The deadline was confirmed during source review; the provider page text extraction showed the application as open but did not expose the date in the extracted copy.'
  ),
  updated_at = now()
where application_url = 'https://www.decagonfoundation.org/apply';
