-- שומר לריצה שנתקעת של העוזר בוואטסאפ (20/10/2026, מיכאל בשאלון: "בצע: שומר לריצה שנתקעת").
-- pg_cron קורא ל-POST /api/wa-morning עם {"watch": true} כל 5 דקות, באותה צורה כמו wa-morning:
-- הסוד מה-Vault, net.http_post. השרת שולח שורה אחת למיכאל רק כשאין תשובה 10 דקות אחרי ההודעה שלו
-- (20 כשנשלח רק "מתחיל"), פעם אחת לכל הודעה (server_state.wa_watch_last), ועד שעה אחריה.
-- בטוח להרצה חוזרת. לעצירה: select cron.unschedule('wa-watch');
create or replace function private.wa_watch_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/wa-morning',
    body := '{"watch": true}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 30000
  );
end
$$;
revoke all on function private.wa_watch_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'wa-watch';
select cron.schedule('wa-watch', '*/5 * * * *', 'select private.wa_watch_tick()');
