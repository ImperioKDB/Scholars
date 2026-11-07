-- Resource Center Phase 1 schema.
-- Additive only: no existing Scholars tables, rows, policies or functions are
-- altered. Public access is through explicit projection views, not base tables.

create table if not exists public.resource_editorial_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 160),
  bio text check (bio is null or char_length(bio) <= 1000),
  avatar_path text check (avatar_path is null or avatar_path !~ '(^|/)(\.\.|\\\\)'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists resource_editorial_identities_user_uidx
  on public.resource_editorial_identities(user_id)
  where user_id is not null;
create index if not exists resource_editorial_identities_active_idx
  on public.resource_editorial_identities(is_active, display_name);

create table if not exists public.resource_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists resource_categories_active_idx
  on public.resource_categories(is_active, display_order, slug);

create table if not exists public.resource_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(btrim(title)) between 1 and 220),
  excerpt text check (excerpt is null or char_length(excerpt) <= 500),
  content_markdown text not null default '' check (char_length(content_markdown) <= 500000),
  article_type text not null default 'guide' check (article_type in ('guide', 'news', 'deadline', 'opportunity')),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'scheduled', 'published', 'archived')),
  scheduled_for timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  last_reviewed_at timestamptz,
  canonical_url text check (canonical_url is null or canonical_url ~ '^https://'),
  featured_image_path text check (featured_image_path is null or featured_image_path !~ '(^|/)(\.\.|\\\\)'),
  reading_time_minutes integer check (reading_time_minutes is null or reading_time_minutes between 1 and 240),
  author_identity_id uuid not null references public.resource_editorial_identities(id) on delete restrict,
  reviewer_identity_id uuid references public.resource_editorial_identities(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  published_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resource_articles_scheduled_requires_time
    check (status <> 'scheduled' or scheduled_for is not null),
  constraint resource_articles_published_requires_time
    check (status <> 'published' or published_at is not null),
  constraint resource_articles_published_requires_reviewer
    check (status not in ('in_review', 'scheduled', 'published') or reviewer_identity_id is not null)
);
create index if not exists resource_articles_public_idx
  on public.resource_articles(status, published_at desc);
create index if not exists resource_articles_scheduled_idx
  on public.resource_articles(status, scheduled_for);
create index if not exists resource_articles_author_idx
  on public.resource_articles(author_identity_id);
create index if not exists resource_articles_reviewer_idx
  on public.resource_articles(reviewer_identity_id);

create table if not exists public.resource_article_categories (
  article_id uuid not null references public.resource_articles(id) on delete cascade,
  category_id uuid not null references public.resource_categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (article_id, category_id)
);
create index if not exists resource_article_categories_category_idx
  on public.resource_article_categories(category_id, article_id);

create table if not exists public.resource_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.resource_articles(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  state jsonb not null,
  schema_version integer not null default 1 check (schema_version = 1),
  change_summary text check (change_summary is null or char_length(change_summary) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (article_id, revision_number),
  constraint resource_revisions_state_object check (jsonb_typeof(state) = 'object')
);
create index if not exists resource_revisions_article_idx
  on public.resource_revisions(article_id, revision_number desc);

alter table public.resource_articles
  add constraint resource_articles_published_revision_fk
  foreign key (published_revision_id)
  references public.resource_revisions(id)
  on delete restrict;

alter table public.resource_editorial_identities enable row level security;
alter table public.resource_categories enable row level security;
alter table public.resource_articles enable row level security;
alter table public.resource_article_categories enable row level security;
alter table public.resource_revisions enable row level security;

-- Base tables are admin/editor surfaces only. Public roles use projection views.
revoke all on table public.resource_editorial_identities,
  public.resource_categories,
  public.resource_articles,
  public.resource_article_categories,
  public.resource_revisions
  from anon, authenticated;
grant all on table public.resource_editorial_identities,
  public.resource_categories,
  public.resource_articles,
  public.resource_article_categories,
  public.resource_revisions
  to service_role;
grant select, insert, update on table public.resource_editorial_identities,
  public.resource_categories,
  public.resource_articles,
  public.resource_article_categories
  to authenticated;
grant select, insert on table public.resource_revisions to authenticated;

create policy resource_editorial_admin_all
  on public.resource_editorial_identities for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
create policy resource_categories_admin_all
  on public.resource_categories for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
create policy resource_articles_admin_all
  on public.resource_articles for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
create policy resource_article_categories_admin_all
  on public.resource_article_categories for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
create policy resource_revisions_admin_insert
  on public.resource_revisions for insert to authenticated
  with check (public.is_admin(auth.uid()) and created_by = auth.uid());
create policy resource_revisions_admin_select
  on public.resource_revisions for select to authenticated
  using (public.is_admin(auth.uid()));

-- Public projections deliberately run with the view owner rather than the
-- visitor's base-table privileges. The WHERE predicates are fixed, the views
-- list approved columns explicitly, and public roles have no base-table SELECT.
-- security_barrier prevents unsafe predicate reordering around the public
-- publication boundary.
create or replace view public.resource_public_editorial_identities
with (security_barrier = true) as
select id, display_name, bio, avatar_path
from public.resource_editorial_identities
where is_active = true;

create or replace view public.resource_public_categories
with (security_barrier = true) as
select id, slug, name, description, display_order
from public.resource_categories
where is_active = true;

create or replace view public.resource_public_articles
with (security_barrier = true) as
select
  a.id,
  a.slug,
  a.title,
  a.excerpt,
  a.content_markdown,
  a.article_type,
  a.canonical_url,
  a.featured_image_path,
  a.reading_time_minutes,
  a.published_at,
  a.last_reviewed_at,
  author.display_name as author_name,
  author.bio as author_bio,
  author.avatar_path as author_avatar_path
from public.resource_articles a
join public.resource_editorial_identities author
  on author.id = a.author_identity_id
 and author.is_active = true
where a.status = 'published'
  and a.published_at is not null
  and a.published_at <= now();

create or replace view public.resource_public_article_categories
with (security_barrier = true) as
select ac.article_id, c.id as category_id, c.slug, c.name, c.description, c.display_order
from public.resource_article_categories ac
join public.resource_categories c on c.id = ac.category_id
join public.resource_articles a on a.id = ac.article_id
where c.is_active = true
  and a.status = 'published'
  and a.published_at is not null
  and a.published_at <= now();

revoke all on table public.resource_public_editorial_identities,
  public.resource_public_categories,
  public.resource_public_articles,
  public.resource_public_article_categories
  from public;
grant select on table public.resource_public_editorial_identities,
  public.resource_public_categories,
  public.resource_public_articles,
  public.resource_public_article_categories
  to anon, authenticated;
