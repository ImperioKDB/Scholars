-- CBIAS describes an ageing research topic, not an academic-discipline restriction.
-- Keep that context in the description and research notes, but do not put it in
-- scholarships.discipline because the matching engine treats that column as a
-- student's field of study.

update public.scholarships
set discipline = null,
    updated_at = now()
where provider_name = 'Emerging Researchers & Professionals in Ageing-African Network (ERPAAN)'
  and title in ('CBIAS Undergraduate Scholarship', 'CBIAS Graduate Scholarship');
