-- Explicit RLS for tables used by the audited API routes. These policies are
-- intentionally owner-scoped; application checks are only defense in depth.

alter table public.waec_results enable row level security;
drop policy if exists waec_results_select_own on public.waec_results;
drop policy if exists waec_results_insert_own on public.waec_results;
drop policy if exists waec_results_update_own on public.waec_results;
drop policy if exists waec_results_delete_own on public.waec_results;
create policy waec_results_select_own on public.waec_results
  for select to authenticated using (profile_id = auth.uid());
create policy waec_results_insert_own on public.waec_results
  for insert to authenticated with check (profile_id = auth.uid());
create policy waec_results_update_own on public.waec_results
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy waec_results_delete_own on public.waec_results
  for delete to authenticated using (profile_id = auth.uid());

alter table public.opportunities enable row level security;
drop policy if exists opportunities_select_verified on public.opportunities;
drop policy if exists opportunities_admin_all on public.opportunities;
create policy opportunities_select_verified on public.opportunities
  for select to anon, authenticated using (verified = true);
create policy opportunities_admin_all on public.opportunities
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

alter table public.saved_opportunities enable row level security;
drop policy if exists saved_opportunities_select_own on public.saved_opportunities;
drop policy if exists saved_opportunities_insert_own on public.saved_opportunities;
drop policy if exists saved_opportunities_update_own on public.saved_opportunities;
drop policy if exists saved_opportunities_delete_own on public.saved_opportunities;
create policy saved_opportunities_select_own on public.saved_opportunities
  for select to authenticated using (profile_id = auth.uid());
create policy saved_opportunities_insert_own on public.saved_opportunities
  for insert to authenticated with check (profile_id = auth.uid());
create policy saved_opportunities_update_own on public.saved_opportunities
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy saved_opportunities_delete_own on public.saved_opportunities
  for delete to authenticated using (profile_id = auth.uid());
