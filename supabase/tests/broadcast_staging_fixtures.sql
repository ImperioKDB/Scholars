\getenv staging_admin_password BROADCAST_STAGING_ADMIN_PASSWORD
\getenv staging_web_public BROADCAST_STAGING_SUBSCRIPTION_KEY
\getenv staging_web_auth BROADCAST_STAGING_SUBSCRIPTION_AUTH
set local search_path = public, extensions, pg_catalog;

-- Password login is seeded directly. Auth confirmation and invitation mail are unnecessary.
with seeds as (
  select ('41000000-0000-4000-8000-' || lpad(to_hex(n),12,'0'))::uuid as id,
    'broadcast-qualification-' || lpad(n::text,3,'0') || '@broadcast.example.invalid' as email,
    null::text as password
  from generate_series(1,300) n
  union all
  select '42000000-0000-4000-8000-000000000001'::uuid, 'broadcast-qualification-admin@broadcast.example.invalid',
    crypt(:'staging_admin_password', gen_salt('bf'))
)
insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,
  confirmation_token,recovery_token,email_change,email_change_token_new,created_at,updated_at
)
select '00000000-0000-0000-0000-000000000000',id,'authenticated','authenticated',email,password,now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Broadcast Qualification"}', '', '', '', '', now(), now()
from seeds
on conflict (id) do nothing;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id::text, id, jsonb_build_object('sub', id, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users where id = '42000000-0000-4000-8000-000000000001'
on conflict (provider_id, provider) do nothing;

insert into public.profiles(id,full_name,is_admin)
select id, 'Broadcast Qualification', id = '42000000-0000-4000-8000-000000000001'
from auth.users where email like '%@broadcast.example.invalid'
on conflict (id) do nothing;

update public.profiles set is_admin = true, profile_completeness = 100
where id = '42000000-0000-4000-8000-000000000001';

insert into public.scholarships(id,title,provider_name,slug,verified,deadline,level)
select ('43000000-0000-4000-8000-' || lpad(to_hex(n),12,'0'))::uuid,
  'Broadcast Qualification ' || n, 'Synthetic', 'broadcast-qualification-' || n, true, current_date + 30, 'undergrad'
from generate_series(1,10) n
on conflict (id) do nothing;

insert into public.push_tokens(id,profile_id,expo_push_token,platform)
select ('44000000-0000-4000-8000-' || lpad(to_hex(n),12,'0'))::uuid,
  ('41000000-0000-4000-8000-' || lpad(to_hex(n),12,'0'))::uuid,
  'ExpoPushToken[BroadcastQualification' || lpad(n::text,3,'0') || ']', 'android'
from generate_series(1,39) n
on conflict (id) do nothing;

insert into public.web_push_subscriptions(id,profile_id,endpoint,p256dh,auth)
select ('45000000-0000-4000-8000-' || lpad(to_hex(n),12,'0'))::uuid,
  ('41000000-0000-4000-8000-' || lpad(to_hex(n),12,'0'))::uuid,
  'https://fcm.googleapis.com/send/broadcast-qualification-' || lpad(n::text,3,'0'),
  :'staging_web_public', :'staging_web_auth'
from generate_series(40,78) n
on conflict (id) do nothing;

select count(*) as fixture_recipients from auth.users
where email ~ '^broadcast-qualification-[0-9]{3}@broadcast\.example\.invalid$';
