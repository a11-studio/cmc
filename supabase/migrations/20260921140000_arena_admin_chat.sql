-- Synthetic agent row for human admin messages on the arena floor (chat FK).
insert into public.agents (id, name, description, strategy, initial_capital, status, risk_profile)
values (
  'arena-admin',
  'Arena admin',
  'Human operator commentary on the shared floor',
  'Operator',
  0,
  'PAUSED',
  'none'
)
on conflict (id) do nothing;
