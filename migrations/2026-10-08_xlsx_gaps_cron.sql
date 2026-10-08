-- בדיקת פערים לילית בין האפליקציה ללוח הבקרה המרכזי ב-Excel (מיכאל, 08/10/2026: "בצע: כמו בתוכנית").
-- כל לילה pg_cron קורא ל-POST /api/xlsx-gaps, באותה צורה כמו od-scan:
-- הסוד מה-Vault, net.http_post, הרשאת EXECUTE ל-postgres בלבד.
-- השרת קורא את ה-Excel בקריאה בלבד ושומר ב-server_state.xlsx_gaps; המייל השבועי מציג שורה.
-- 03:05 UTC = 05:05/06:05 בישראל, אחרי od-scan. בטוח להרצה חוזרת.
-- לעצירה: select cron.unschedule('xlsx-gaps');
create or replace function private.xlsx_gaps_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/xlsx-gaps',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$$;
revoke all on function private.xlsx_gaps_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'xlsx-gaps';
select cron.schedule('xlsx-gaps', '5 3 * * *', 'select private.xlsx_gaps_tick()');
