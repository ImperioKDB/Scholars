-- Add review-tier aggregators to the discovery registry.
-- They may feed candidates into admin review, never directly into the public catalogue.
insert into public.discovery_sources (name, base_url, source_type, trust_tier, enabled, pilot_enabled, crawl_policy)
values
  ('Scholarship Region', 'https://www.scholarshipregion.com/', 'secondary', 'review', true, true, 'manual-review-first'),
  ('ScholarshipAir Nigeria', 'https://www.scholarshipair.com/', 'secondary', 'review', true, true, 'manual-review-first')
on conflict (name) do update
set base_url = excluded.base_url,
    source_type = excluded.source_type,
    trust_tier = excluded.trust_tier,
    enabled = true,
    pilot_enabled = true,
    crawl_policy = excluded.crawl_policy;
