-- Rezzies Notification Scheduler — pg_cron schedule (TYC-138)
--
-- Runs the notification-scheduler edge function every 15 minutes via
-- pg_cron + pg_net. This is the AUTHORITATIVE schedule: Deno.cron is
-- unreliable on the hosted Supabase edge runtime (it can throw at module
-- load and 503 the whole function), so the function only registers Deno.cron
-- when the runtime supports it and otherwise relies on this job.
--
-- The function's HTTP entrypoint is POST .../notification-scheduler/run and it
-- has verify_jwt = true, so the cron call must present a valid JWT. We use the
-- project service_role key, read from Supabase Vault so the secret is never
-- written into cron.job (which would expose it to anyone who can read that
-- table).
--
-- PREREQUISITE (per-project, NOT committed here because it holds a secret):
-- store the service_role key in Vault under the name 'service_role_key':
--   select vault.create_secret(
--     '<service_role_key>', 'service_role_key',
--     'service role JWT used by the notification cron to call the edge function');
-- If the secret is absent the job still runs but the edge call returns 401;
-- create the secret and the next tick succeeds.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop any prior copy of this job before (re)scheduling.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'notification-scheduler-15min') then
    perform cron.unschedule('notification-scheduler-15min');
  end if;
end$$;

select cron.schedule(
  'notification-scheduler-15min',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := 'https://umnowggiuiotsgsnvvuj.supabase.co/functions/v1/notification-scheduler/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'service_role_key' limit 1
      )
    ),
    body := '{}'::jsonb
  );
  $job$
);
