-- 10/10/2026: טופס קליטה חתום של עובד חדש נשלח למיכאל ולמשאבי אנוש ומתויק בתיקייה (מיכאל בשאלון:
-- "בצע: אליי ול-hr-tap@tapugan.co.il", "בצע: 11_הדרכות/12_קליטת עובדים חדשים/<שנה>").
-- doc_url: הקובץ בתיקייה. mailed_at: מתי המייל יצא. doc_err: למה לא, אם נכשל. מוצג ב"מי חתם".
-- הוספה בלבד. toolbox_reads גובתה היום (backup_20261010.toolbox_reads).
alter table public.toolbox_reads add column if not exists doc_url text;
alter table public.toolbox_reads add column if not exists mailed_at timestamptz;
alter table public.toolbox_reads add column if not exists doc_err text;
UPDATE public.server_state SET value = (
  select coalesce(jsonb_agg(c order by c), '[]'::jsonb)::text
    from (select table_name || '.' || column_name as c from information_schema.columns where table_schema = 'public') x
), updated_at = now() WHERE key = 'db_columns_snapshot';
