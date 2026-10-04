-- סריקת תיקיית הבטיחות ב-OneDrive (מיכאל, 04/10/2026: "מאשר הכל").
-- כל לילה pg_cron קורא ל-POST /api/od-scan, באותה צורה כמו weekly-digest ו-backup-od:
-- הסוד מה-Vault, net.http_post, הרשאת EXECUTE ל-postgres בלבד.
-- השרת שומר ב-server_state.od_scan את הקבצים שנוספו לתיקייה (62 יום אחרונים).
-- המייל השבועי מציג את הקבצים של 7 הימים האחרונים, ומדווח כשהסריקה נכשלה או לא רצה.
-- 02:50 UTC = 04:50/05:50 בישראל, לפני המייל של יום ראשון ב-07:00. בטוח להרצה חוזרת.
-- לעצירה: select cron.unschedule('od-scan');
create or replace function private.od_scan_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/od-scan',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$$;
revoke all on function private.od_scan_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'od-scan';
select cron.schedule('od-scan', '50 2 * * *', 'select private.od_scan_tick()');
