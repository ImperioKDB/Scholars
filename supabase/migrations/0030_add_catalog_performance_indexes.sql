-- High-traffic catalog browse and dashboard match indexes.
-- Partial indexes keep write and index size lower by excluding unverified rows.
create index if not exists idx_scholarships_verified_deadline
  on public.scholarships (deadline, id)
  where verified = true;

create index if not exists idx_opportunities_verified_deadline
  on public.opportunities (deadline, id)
  where verified = true;

create index if not exists idx_cycle_events_scholarship_event_date
  on public.cycle_events (scholarship_id, event_date desc);
