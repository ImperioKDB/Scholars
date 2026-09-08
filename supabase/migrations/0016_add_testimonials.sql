-- Testimonials: real, consented student quotes with photos for the
-- landing page social proof section (components/TestimonialsSection.tsx).
--
-- Integrity by schema, not by discipline:
--   * consent records that the student gave written permission for their
--     words AND photo. approved is the separate publish switch.
--   * The public select policy requires BOTH true, so an unconsented or
--     unpublished row can never reach the landing page even if UI or API
--     code has a bug. Admins get a separate select policy to see drafts.
--   * Photos live in the existing public 'site' bucket (migration 0013)
--     under testimonials/<id>.jpg, admin-write only. No new bucket.
--
-- IDEMPOTENT: IF NOT EXISTS + drop-then-create policies, safe to re-run.
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  quote text not null check (char_length(quote) between 10 and 300),
  full_name text not null check (char_length(full_name) between 2 and 80),
  role text not null check (char_length(role) between 2 and 120),
  photo_url text,
  consent boolean not null default false,
  approved boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.testimonials enable row level security;

drop policy if exists "testimonials_public_read" on public.testimonials;
create policy "testimonials_public_read"
  on public.testimonials for select
  using (approved and consent);

drop policy if exists "testimonials_admin_select" on public.testimonials;
create policy "testimonials_admin_select"
  on public.testimonials for select to authenticated
  using (is_admin(auth.uid()));

drop policy if exists "testimonials_admin_insert" on public.testimonials;
create policy "testimonials_admin_insert"
  on public.testimonials for insert to authenticated
  with check (is_admin(auth.uid()));

drop policy if exists "testimonials_admin_update" on public.testimonials;
create policy "testimonials_admin_update"
  on public.testimonials for update to authenticated
  using (is_admin(auth.uid()));

drop policy if exists "testimonials_admin_delete" on public.testimonials;
create policy "testimonials_admin_delete"
  on public.testimonials for delete to authenticated
  using (is_admin(auth.uid()));

create index if not exists idx_testimonials_order
  on public.testimonials (sort_order asc, created_at desc);
