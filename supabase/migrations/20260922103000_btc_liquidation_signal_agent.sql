insert into public.agents (id, name, description, strategy, initial_capital, status, risk_profile)
values
  (
    'btc-liquidation-signal',
    'BTC Liquidation Signal',
    'Trades BTC from the Arena liquidation signal — bearish short, neutral hold, bullish buy',
    'Liquidation Flow',
    10000,
    'ACTIVE',
    'medium'
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  strategy = excluded.strategy,
  risk_profile = excluded.risk_profile;
