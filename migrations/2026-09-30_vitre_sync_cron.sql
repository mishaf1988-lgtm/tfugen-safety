-- Daily refresher import from Vitre, from the server (Michael, 30/09/2026:
-- "once a day, with no dependency on anything"). Until now _vitreAutoSync ran
-- only when an admin opened the home screen. pg_cron now calls
-- /api/vitre?op=sync every morning at 06:00 Israel time, the same way
-- trustee-log-retry calls /api/trustee-log: secret from the Vault,
-- net.http_post, EXECUTE for postgres only. The result lands in
-- public.server_state (key vitre_sync) and the home screen shows it.
--
-- pg_cron runs in UTC and Israel moves between UTC+2 and UTC+3, so the job
-- fires at 03:00 and 04:00 UTC and the function goes on only when it is 06
-- o'clock in Jerusalem: one run a day, summer and winter. Safe to re-run.
create or replace function private.vitre_sync_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare s text;
begin
  if extract(hour from (now() at time zone 'Asia/Jerusalem')) <> 6 then return; end if;
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/vitre?op=sync',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$$;
revoke all on function private.vitre_sync_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'vitre-sync';
select cron.schedule('vitre-sync', '0 3,4 * * *', 'select private.vitre_sync_tick()');
