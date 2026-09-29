-- The profile upsert includes has_english_maths_credit, but the original
-- column-scoped INSERT grant omitted it. PostgreSQL checks INSERT privileges
-- for every column in an upsert payload, including conflict updates.
grant insert (has_english_maths_credit)
  on table public.profiles to authenticated;
