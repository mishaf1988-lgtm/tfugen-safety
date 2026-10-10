-- 10/10/2026: הדרכה שבועית משויכת למחלקה. מיכאל בשאלון: "בצע: כל הדרכה שבועית משויכת למחלקה"
-- ("כרגע זה רק למחלקות"). null = כל המפעל. דף העובד מציג את עובדי המחלקה, ו"לא חתמו" סופר רק אותם.
-- הוספה בלבד. toolbox_talks גובתה היום (backup_20261010.toolbox_talks).
alter table public.toolbox_talks add column if not exists dept text;
UPDATE public.server_state SET value = (
  select coalesce(jsonb_agg(c order by c), '[]'::jsonb)::text
    from (select table_name || '.' || column_name as c from information_schema.columns where table_schema = 'public') x
), updated_at = now() WHERE key = 'db_columns_snapshot';
