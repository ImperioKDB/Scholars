-- Public SEO URLs for catalog listings.
-- Slugs are title-derived and carry a short UUID suffix so they remain unique
-- without needing a fragile collision-resolution loop. Existing URLs remain
-- supported by the legacy redirect routes in the application.

alter table public.scholarships add column if not exists slug text;
alter table public.opportunities add column if not exists slug text;

create or replace function public.catalog_slug(title_text text, id_text text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(lower(coalesce(title_text, 'listing')), '[^a-z0-9]+', '-', 'g'),
    '(^-+|-+$)', '', 'g'
  )) || '-' || left(replace(id_text, '-', ''), 8)
$$;

update public.scholarships
set slug = public.catalog_slug(title, id::text)
where slug is null or slug = '';

update public.opportunities
set slug = public.catalog_slug(title, id::text)
where slug is null or slug = '';

alter table public.scholarships alter column slug set not null;
alter table public.opportunities alter column slug set not null;

create unique index if not exists scholarships_slug_key on public.scholarships (slug);
create unique index if not exists opportunities_slug_key on public.opportunities (slug);

create or replace function public.set_catalog_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.catalog_slug(new.title, new.id::text);
  end if;
  return new;
end;
$$;

drop trigger if exists scholarships_set_catalog_slug on public.scholarships;
create trigger scholarships_set_catalog_slug
before insert or update on public.scholarships
for each row execute function public.set_catalog_slug();

drop trigger if exists opportunities_set_catalog_slug on public.opportunities;
create trigger opportunities_set_catalog_slug
before insert or update on public.opportunities
for each row execute function public.set_catalog_slug();
