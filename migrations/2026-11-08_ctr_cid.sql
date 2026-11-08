-- ח.פ לקבלן ובדיקה מול המרשמים הממשלתיים (מיכאל, 08/11/2026, בשאלון: "בצע: בדיקת קבלן מול המרשמים",
-- "בצע: שדה ח.פ + הצעה לפי שם", "בצע: לבנות ככה"; DECISIONS 08/11/2026).
-- (1) גיבוי של ctr לפני שינוי הסכמה (10 שורות).
-- (2) עמודה cid (ח.פ, 9 ספרות, ריקה = null).
-- (3) pg_cron שבועי: POST /api/registry?op=check, כמו weather. בודק ש-data.gov.il עונה עם השדות שהאפליקציה קוראת,
--     וכותב server_state.registry_probe; המייל השבועי מדווח כשהבדיקה נכשלה או לא רצה.
-- שלישי 05:23 UTC. בטוח להרצה חוזרת. לעצירה: select cron.unschedule('registry_probe');
-- rollback: alter table public.ctr drop column if exists cid;  (באישור מפורש בלבד)

create schema if not exists backup_ops_20261108;
create table if not exists backup_ops_20261108.ctr as table public.ctr;

alter table public.ctr add column if not exists cid text;

create or replace function private.registry_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/registry?op=check',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$$;
revoke all on function private.registry_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'registry_probe';
select cron.schedule('registry_probe', '23 5 * * 2', 'select private.registry_tick()');
