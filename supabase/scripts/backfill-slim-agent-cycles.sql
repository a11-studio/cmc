-- Manual backfill: slim legacy fat agent_cycles.payload rows.
-- Requires migration 20260921160000_slim_agent_cycle_payload_fn.sql applied first.
--
-- 1) Preview how many rows still need slimming:
select count(*) as fat_rows
from public.agent_cycles
where status <> 'CLAIMED'
  and (
    payload ? 'snapshot'
    or payload ? 'account'
    or payload ? 'events'
    or payload ? 'trace'
    or (
      payload ? 'execution'
      and (
        (payload -> 'execution') ? 'account'
        or (payload -> 'execution') ? 'valuation'
      )
    )
  );

-- 2) Sample before/after size (bytes) on 5 rows:
select
  cycle_id,
  pg_column_size(payload) as before_bytes,
  pg_column_size(public.slim_agent_cycle_payload(payload)) as after_bytes
from public.agent_cycles
where status <> 'CLAIMED'
  and payload ? 'snapshot'
order by started_at desc
limit 5;

-- 3) Apply in batches (repeat until fat_rows = 0). Each batch updates up to 100 rows.
--    Run during low traffic; watch Supabase egress/CPU.
with targets as (
  select agent_id, cycle_id
  from public.agent_cycles
  where status <> 'CLAIMED'
    and (
      payload ? 'snapshot'
      or payload ? 'account'
      or payload ? 'events'
      or payload ? 'trace'
    )
  order by started_at asc
  limit 100
)
update public.agent_cycles ac
set payload = public.slim_agent_cycle_payload(ac.payload)
from targets t
where ac.agent_id = t.agent_id
  and ac.cycle_id = t.cycle_id;

-- 4) Verify: should return 0
select count(*) as remaining_fat
from public.agent_cycles
where status <> 'CLAIMED'
  and (payload ? 'snapshot' or payload ? 'account' or payload ? 'events' or payload ? 'trace');
