-- Trustee log: a retry every 15 minutes (Michael, 27/09: "everything automatic
-- end to end"). The trigger writes the OneDrive file after each report, but a
-- file open in Excel answers 423 and, until now, the next try waited for the
-- next report. The tick calls the same endpoint the trigger calls; when nothing
-- changed and every photo is copied it answers "unchanged" and writes nothing
-- (a few Supabase reads). Same secret, from Vault. Safe to re-run.
create extension if not exists pg_cron;

create or replace function private.trustee_log_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/trustee-log',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 20000
  );
end
$$;
revoke all on function private.trustee_log_tick() from public, anon, authenticated;

-- Replace, not duplicate, on a re-run.
select cron.unschedule(jobid) from cron.job where jobname = 'trustee-log-retry';
select cron.schedule('trustee-log-retry', '*/15 * * * *', 'select private.trustee_log_tick()');
