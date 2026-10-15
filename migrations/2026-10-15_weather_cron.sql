-- מזג האוויר של מחר במפעל (מיכאל, 15/10/2026: "בצע: מזג אוויר מול היתרי עבודה").
-- כל יום pg_cron קורא ל-POST /api/weather?op=check, באותה צורה כמו xlsx-gaps:
-- הסוד מה-Vault, net.http_post, הרשאת EXECUTE ל-postgres בלבד.
-- השרת קורא את התחזית של השירות המטאורולוגי (שדרות, 62) ושומר ב-server_state.weather_tomorrow;
-- מסך הבית מציג שורה כשמחר בין 06:00 ל-18:00 יש עומס חום, משבי רוח או גשם.
-- 14:07 UTC = 17:07 בישראל בקיץ, 16:07 בחורף. בטוח להרצה חוזרת.
-- לעצירה: select cron.unschedule('weather');
create or replace function private.weather_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/weather?op=check',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$$;
revoke all on function private.weather_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'weather';
select cron.schedule('weather', '7 14 * * *', 'select private.weather_tick()');
