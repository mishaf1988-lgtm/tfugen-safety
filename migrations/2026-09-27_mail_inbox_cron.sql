-- A reply "טופל" to a trustee alert closes the finding (functions/api/mail-inbox.js).
-- Every 5 minutes, the same way trustee-log-retry calls /api/trustee-log:
-- secret from Vault, net.http_post, EXECUTE for postgres only. Until the
-- Outlook connection is re-consented with Mail.Read the endpoint answers
-- {"skipped":"no Mail.Read"} after one token read. Safe to re-run.
create or replace function private.mail_inbox_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/mail-inbox',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 25000
  );
end
$$;
revoke all on function private.mail_inbox_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'mail-inbox';
select cron.schedule('mail-inbox', '*/5 * * * *', 'select private.mail_inbox_tick()');
