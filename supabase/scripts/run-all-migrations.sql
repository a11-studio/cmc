-- ===== 20260917120000_arena.sql =====
-- AI Trading Arena schema (Momentum Alpha persistence + realtime).
-- Apply in the Supabase SQL editor if the CLI is not linked.

create table if not exists public.agents (
  id text primary key,
  name text not null,
  description text,
  strategy text,
  initial_capital double precision not null default 10000,
  status text not null default 'ACTIVE',
  risk_profile text,
  account_payload jsonb not null default '{}'::jsonb,
  day_start_equity double precision,
  last_equity double precision,
  day_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  cycle_id text not null unique,
  timestamp timestamptz not null,
  payload jsonb not null
);

create table if not exists public.agent_cycles (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents (id) on delete cascade,
  cycle_id text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null,
  market_snapshot_id uuid references public.market_snapshots (id),
  error jsonb,
  payload jsonb not null default '{}'::jsonb,
  unique (agent_id, cycle_id)
);

create table if not exists public.decisions (
  id text primary key,
  agent_id text not null references public.agents (id) on delete cascade,
  cycle_id text not null,
  action text not null,
  symbol text not null,
  allocation_percent double precision not null,
  confidence double precision not null,
  stop_loss_percent double precision,
  take_profit_percent double precision,
  time_horizon text,
  reasons jsonb not null default '[]'::jsonb,
  risk_factors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.risk_checks (
  id uuid primary key default gen_random_uuid(),
  decision_id text not null references public.decisions (id) on delete cascade,
  approved boolean not null,
  verdict text,
  reason text,
  adjusted_allocation_percent double precision,
  created_at timestamptz not null default now(),
  unique (decision_id)
);

create table if not exists public.trades (
  id text primary key,
  agent_id text not null references public.agents (id) on delete cascade,
  decision_id text,
  symbol text not null,
  side text not null,
  quantity double precision not null,
  price double precision not null,
  notional double precision not null,
  realized_pnl double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents (id) on delete cascade,
  symbol text not null,
  quantity double precision not null,
  average_entry_price double precision not null,
  updated_at timestamptz not null default now(),
  unique (agent_id, symbol)
);

create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents (id) on delete cascade,
  cycle_id text,
  timestamp timestamptz not null default now(),
  cash double precision not null,
  equity double precision not null,
  realized_pnl double precision not null default 0,
  unrealized_pnl double precision not null default 0,
  return_percent double precision not null default 0,
  drawdown_percent double precision not null default 0,
  unique (agent_id, cycle_id)
);

create table if not exists public.activity_events (
  id text primary key,
  agent_id text not null references public.agents (id) on delete cascade,
  cycle_id text,
  type text not null,
  title text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_cycles_agent_started_idx
  on public.agent_cycles (agent_id, started_at);

create index if not exists activity_events_agent_created_idx
  on public.activity_events (agent_id, created_at desc);

create index if not exists portfolio_snapshots_agent_time_idx
  on public.portfolio_snapshots (agent_id, timestamp desc);

alter table public.agents enable row level security;
alter table public.market_snapshots enable row level security;
alter table public.agent_cycles enable row level security;
alter table public.decisions enable row level security;
alter table public.risk_checks enable row level security;
alter table public.trades enable row level security;
alter table public.positions enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists agents_public_read on public.agents;
create policy agents_public_read on public.agents for select using (true);

drop policy if exists market_snapshots_public_read on public.market_snapshots;
create policy market_snapshots_public_read on public.market_snapshots for select using (true);

drop policy if exists agent_cycles_public_read on public.agent_cycles;
create policy agent_cycles_public_read on public.agent_cycles for select using (true);

drop policy if exists decisions_public_read on public.decisions;
create policy decisions_public_read on public.decisions for select using (true);

drop policy if exists risk_checks_public_read on public.risk_checks;
create policy risk_checks_public_read on public.risk_checks for select using (true);

drop policy if exists trades_public_read on public.trades;
create policy trades_public_read on public.trades for select using (true);

drop policy if exists positions_public_read on public.positions;
create policy positions_public_read on public.positions for select using (true);

drop policy if exists portfolio_snapshots_public_read on public.portfolio_snapshots;
create policy portfolio_snapshots_public_read on public.portfolio_snapshots for select using (true);

drop policy if exists activity_events_public_read on public.activity_events;
create policy activity_events_public_read on public.activity_events for select using (true);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['activity_events', 'portfolio_snapshots', 'trades', 'agents']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception
      when duplicate_object then null;
    end;
  end loop;
end $$;

insert into public.agents (id, name, description, strategy, initial_capital, status, risk_profile)
values
  (
    'momentum-alpha',
    'Elon Musk',
    'Follows short-term trend while respecting position caps',
    'Narrative momentum',
    10000,
    'ACTIVE',
    'medium'
  ),
  (
    'richard-dennis',
    'Richard Dennis',
    'Systematic trend following inspired by Turtle breakout principles',
    'The Turtle',
    10000,
    'ACTIVE',
    'medium'
  ),
  (
    'richard-donchian',
    'Richard Donchian',
    'Low-discretion breakout and channel-style trend following',
    'The Trend',
    10000,
    'ACTIVE',
    'medium'
  ),
  (
    'jesse-livermore',
    'Jesse Livermore',
    'Price-action speculator that trades confirmed momentum, not stories',
    'The Speculator',
    10000,
    'ACTIVE',
    'aggressive'
  ),
  (
    'paul-tudor-jones',
    'Paul Tudor Jones',
    'Capital-first macro regime and momentum trader',
    'The Macro Trader',
    10000,
    'ACTIVE',
    'medium'
  ),
  (
    'jim-simons',
    'Jim Simons',
    'Systematic multi-signal decisions from observable snapshot features only',
    'The Quant',
    10000,
    'ACTIVE',
    'medium'
  ),
  (
    'michael-burry',
    'Michael Burry',
    'Patient contrarian that fades excess, not strong unexhausted trends',
    'The Contrarian',
    10000,
    'ACTIVE',
    'conservative'
  ),
  (
    'arthur-hayes',
    'Arthur Hayes',
    'Crypto-native macro trader that only uses snapshot liquidity and regime fields',
    'The Macro + Crypto Liquidity',
    10000,
    'ACTIVE',
    'aggressive'
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  strategy = excluded.strategy,
  risk_profile = excluded.risk_profile;

-- ===== 20260918120000_arena_chat.sql =====
create table if not exists public.arena_chat_messages (
  id text primary key,
  agent_id text not null references public.agents (id) on delete cascade,
  cycle_id text,
  kind text not null,
  addressed_agent_id text references public.agents (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists arena_chat_messages_created_idx
  on public.arena_chat_messages (created_at);

alter table public.arena_chat_messages enable row level security;

drop policy if exists arena_chat_messages_public_read on public.arena_chat_messages;
create policy arena_chat_messages_public_read on public.arena_chat_messages for select using (true);

do $$
begin
  execute 'alter publication supabase_realtime add table public.arena_chat_messages';
exception
  when duplicate_object then null;
end $$;

-- ===== 20260918130000_warren_buffett.sql =====
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

-- ===== 20260921140000_arena_admin_chat.sql =====
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

-- ===== 20260921160000_slim_agent_cycle_payload_fn.sql =====
-- Idempotent JSONB slimming for legacy agent_cycles.payload (snapshot/account/events/trace
-- live in market_snapshots, agents, trades, and are rebuilt on read).
-- Run the backfill manually in batches — see supabase/scripts/backfill-slim-agent-cycles.sql

create or replace function public.slim_agent_cycle_payload(payload jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb;
  exec jsonb;
begin
  if payload is null or payload = 'null'::jsonb then
    return '{}'::jsonb;
  end if;

  result := payload;

  if not (
    result ? 'snapshot'
    or result ? 'account'
    or result ? 'events'
    or result ? 'trace'
    or (
      result ? 'execution'
      and (
        (result -> 'execution') ? 'account'
        or (result -> 'execution') ? 'valuation'
      )
    )
  ) then
    return result;
  end if;

  if not (result ? 'marketCheckAssets') and result -> 'snapshot' -> 'assets' is not null then
    result := result || jsonb_build_object(
      'marketCheckAssets',
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'symbol',
              asset ->> 'symbol',
              'price',
              (asset ->> 'price')::double precision
            )
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(result -> 'snapshot' -> 'assets') as asset
        where (asset ->> 'price')::double precision > 0
          and asset ? 'symbol'
      )
    );
  end if;

  result := result - 'trace' - 'snapshot' - 'account' - 'events';

  if result ? 'execution' then
    exec := result -> 'execution';
    exec := exec - 'account' - 'valuation';
    result := jsonb_set(result, '{execution}', exec, true);
  end if;

  return result;
end;
$$;

comment on function public.slim_agent_cycle_payload(jsonb) is
  'Strips duplicated agent_cycles payload fields; keeps decision/risk/execution/valuation and marketCheckAssets.';

-- ===== 20260922103000_btc_liquidation_signal_agent.sql =====
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

