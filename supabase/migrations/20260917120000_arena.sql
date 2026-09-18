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
values (
  'momentum-alpha',
  'Momentum Alpha',
  'Follows short-term trend while respecting position caps',
  'Momentum',
  10000,
  'ACTIVE',
  'medium'
)
on conflict (id) do nothing;
