-- Profile photos: students can upload a profile picture (Supabase
-- Storage) instead of the initials avatar.
--
-- APPLIED LIVE via the Supabase SQL editor. This file is a reference
-- record only, per project convention -- do not re-run against the live
-- project.
--
-- Design: one bucket, public read (avatars render anywhere), writes
-- restricted to each user's own folder avatars/<user_id>/. The profiles
-- column stores the resulting public URL so the sidebar/settings never
-- need to probe Storage to know whether a photo exists.
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars_public_read"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "avatars_insert_own"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
