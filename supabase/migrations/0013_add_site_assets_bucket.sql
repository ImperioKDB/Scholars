-- Site assets bucket: holds the About page founder portrait (and any
-- future public, admin-managed imagery) at fixed, guessable paths.
--
-- Design: public read (the About page is public, so every visitor must be
-- able to fetch the object), writes restricted to admins via is_admin(),
-- the same predicate the scholarships RLS policies already use. Fixed
-- object name 'about-portrait.jpg' means the page never needs a DB row to
-- know the URL; existence is probed with a storage list() at render time.
--
-- NOT YET APPLIED. Run in the Supabase SQL editor (or MCP execute_sql).
-- Until it is applied, /about renders its placeholder and the uploader
-- surfaces a clear error; nothing else breaks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "site_public_read"
on storage.objects for select
using (bucket_id = 'site');

create policy "site_insert_admin"
on storage.objects for insert to authenticated
with check (bucket_id = 'site' and is_admin(auth.uid()));

create policy "site_update_admin"
on storage.objects for update to authenticated
using (bucket_id = 'site' and is_admin(auth.uid()));

create policy "site_delete_admin"
on storage.objects for delete to authenticated
using (bucket_id = 'site' and is_admin(auth.uid()));
