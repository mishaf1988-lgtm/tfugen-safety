-- Daily copy of the backups to OneDrive, from the server (upgrade review 21;
-- Michael, 01/10/2026: "yes, do it"). pg_cron calls /api/backup-od every
-- morning at 06:30 Israel time, half an hour after workers/backup-cron.js has
-- written the day's file into the bucket. The function copies it to
-- OneDrive _Backups/cron (15 kept), the month's first one to _Backups/monthly
-- (12 kept) and the new photos to _Backups/photos, and leaves the result in
-- public.server_state (key backup_od). The same pattern as vitre-sync: secret
-- from the Vault, net.http_post, EXECUTE for postgres only.
--
-- pg_cron runs in UTC and Israel moves between UTC+2 and UTC+3, so the job
-- fires at 03:30 and 04:30 UTC and goes on only when it is 06 in Jerusalem.
-- Safe to re-run. Undo: select cron.unschedule('backup-od');
create or replace function private.backup_od_tick()
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
    url := 'https://tapugan-safety.pages.dev/api/backup-od',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$$;
revoke all on function private.backup_od_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'backup-od';
select cron.schedule('backup-od', '30 3,4 * * *', 'select private.backup_od_tick()');
