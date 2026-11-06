-- Hourly agent cycle scheduled inside Supabase (pg_cron + pg_net).
--
-- GitHub Actions' `schedule` trigger proved unreliable: the hourly workflow ran only
-- every 4–8 hours. pg_cron fires on the minute; GitHub Actions stays as a backup
-- trigger later in the hour. Cycles are claimed per UTC hour slot, so whichever
-- trigger arrives second is skipped as a duplicate.
--
-- Before running this file, store the same value as the Vercel CRON_SECRET in Vault
-- (once, in the SQL editor; never commit it):
--
--   select vault.create_secret('<CRON_SECRET>', 'arena_cron_secret');
--
-- To rotate it later:
--
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'arena_cron_secret'),
--     '<NEW_CRON_SECRET>'
--   );

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-running this file replaces the job instead of adding a second one.
select cron.unschedule(jobid) from cron.job where jobname = 'arena-hourly-agent-cycle';

select cron.schedule(
  'arena-hourly-agent-cycle',
  '2 * * * *',
  $job$
  select net.http_post(
    url := 'https://cmc-one-kappa.vercel.app/api/agents/cycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'arena_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    -- A full cycle of six agents takes ~30–60 s; the route allows up to 300 s.
    timeout_milliseconds := 300000
  );
  $job$
);

-- Check it (after the next :02):
--   select status, return_message, start_time from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'arena-hourly-agent-cycle')
--   order by start_time desc limit 5;
--   select status_code, left(content, 200), created from net._http_response
--   order by created desc limit 5;
