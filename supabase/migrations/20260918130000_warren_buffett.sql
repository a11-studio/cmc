-- Warren Buffett replaces Michael Burry in the live roster.
-- Burry's row is left in place: he is commented out of lib/agents/registry.ts, so
-- he stops cycling while his past cycles, decisions and trades stay queryable.

insert into public.agents (id, name, description, strategy, initial_capital, status, risk_profile)
values
  (
    'warren-buffett',
    'Warren Buffett',
    'Long-only quality owner that adds on fear and treats cash as the position to justify',
    'The Value Compounder',
    10000,
    'ACTIVE',
    'conservative'
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  strategy = excluded.strategy,
  risk_profile = excluded.risk_profile;
