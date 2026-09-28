-- External application URLs remain blocked unless explicitly allowlisted per source.
alter table public.discovery_sources add column if not exists application_allowed_hosts text[] not null default '{}';
