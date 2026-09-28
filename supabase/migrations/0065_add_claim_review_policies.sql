-- Admin-only claim review writes; service-role workers remain unrestricted by RLS.
drop policy if exists "discovery_candidate_claims_admin_update" on public.scholarship_discovery_candidate_claims;
create policy "discovery_candidate_claims_admin_update" on public.scholarship_discovery_candidate_claims for update using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
drop policy if exists "discovery_review_events_admin_insert" on public.scholarship_discovery_review_events;
create policy "discovery_review_events_admin_insert" on public.scholarship_discovery_review_events for insert with check (is_admin(auth.uid()));
