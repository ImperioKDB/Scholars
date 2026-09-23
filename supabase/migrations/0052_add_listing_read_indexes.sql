-- Read-path indexes for the student-facing catalog and new-listing digest.
-- All indexes are additive and idempotent; no existing data or schema is removed.

create index if not exists idx_scholarships_verified_created_at
  on public.scholarships (created_at desc, id)
  where verified = true;

create index if not exists idx_opportunities_verified_created_at
  on public.opportunities (created_at desc, id)
  where verified = true;

create index if not exists idx_testimonials_published_order
  on public.testimonials (sort_order, created_at)
  where approved = true and consent = true;
