-- 10/10/2026: הדרכת קליטה לעובד חדש (טופס 08.02) עם קישור קבוע. מיכאל בשאלון: "רק עובדים חדש,
-- אחרים לא רלוונטי" (קבלנים ונהגים לא). kind = 'induction' להדרכת קליטה, null להדרכה שבועית.
-- link_v: גרסת הקישור הקבוע. "בטל קישור" מעלה אותה, והקישור וה-QR הקודמים מפסיקים לעבוד.
-- הוספה בלבד. toolbox_talks גובתה היום (backup_20261010.toolbox_talks).
alter table public.toolbox_talks add column if not exists kind text;
alter table public.toolbox_talks add column if not exists link_v smallint not null default 0;
UPDATE public.server_state SET value = (
  select coalesce(jsonb_agg(c order by c), '[]'::jsonb)::text
    from (select table_name || '.' || column_name as c from information_schema.columns where table_schema = 'public') x
), updated_at = now() WHERE key = 'db_columns_snapshot';
