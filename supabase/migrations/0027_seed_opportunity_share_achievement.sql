-- The live xp_events.event_type column is text, so no enum alteration is
-- required. Seed the achievement consumed by the opportunity share route.
insert into public.achievements (id, label, description, xp_reward, tier)
values (
  'first_opportunity_share',
  'First Opportunity Share',
  'Shared a fellowship, internship, competition, or mentorship with a friend.',
  5,
  'bronze'
)
on conflict (id) do nothing;
