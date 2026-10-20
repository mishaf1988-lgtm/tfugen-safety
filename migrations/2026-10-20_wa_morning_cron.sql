-- עדכון הבוקר בוואטסאפ מהשרת (20/10/2026, מיכאל בשאלון של העוזר: "בצע: להעביר לפיתוח עדכון מהשרת").
-- pg_cron קורא ל-POST /api/wa-morning ב-04:47 וב-05:47 UTC, א'-ה', באותה צורה כמו weather:
-- הסוד מה-Vault, net.http_post, הרשאת EXECUTE ל-postgres בלבד.
-- השרת שולח רק בקריאה שנופלת על 07:xx בישראל (קיץ: 04:47, חורף: 05:47), ופעם אחת ביום
-- (server_state.wa_morning_last). בטוח להרצה חוזרת.
-- לעצירה: select cron.unschedule('wa-morning');
create or replace function private.wa_morning_tick()
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
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$$;
revoke all on function private.wa_morning_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'wa-morning';
select cron.schedule('wa-morning', '47 4,5 * * 0-4', 'select private.wa_morning_tick()');
