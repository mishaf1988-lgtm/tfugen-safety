-- Weekly summary mail to Michael (upgrade review 11; Michael, 30/09/2026:
-- "yes, Sunday 07:00"). pg_cron calls POST /api/weekly-digest the same way
-- vitre-sync calls /api/vitre: secret from the Vault, net.http_post, EXECUTE
-- for postgres only. The endpoint builds the mail from the merged register
-- and sends it through the connected Outlook account (Mail.Send) to that
-- account; the result lands in public.server_state (key weekly_digest).
--
-- pg_cron runs in UTC and Israel moves between UTC+2 and UTC+3, so the job
-- fires on Sunday at 04:00 and 05:00 UTC and the function goes on only when
-- it is 7 o'clock in Jerusalem: one mail a week, summer and winter. The
-- endpoint also skips a second call within 20 hours. Safe to re-run.
-- To stop the mail: select cron.unschedule('weekly-digest');
create or replace function private.weekly_digest_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare s text;
begin
  if extract(hour from (now() at time zone 'Asia/Jerusalem')) <> 7 then return; end if;
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/weekly-digest',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$$;
revoke all on function private.weekly_digest_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'weekly-digest';
select cron.schedule('weekly-digest', '0 4,5 * * 0', 'select private.weekly_digest_tick()');
