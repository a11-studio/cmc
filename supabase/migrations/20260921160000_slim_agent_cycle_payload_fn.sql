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
