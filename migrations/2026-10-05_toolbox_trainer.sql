-- 05/10/2026: מדריך וכשירות בכל הדרכה שבועית.
-- התיקון לתקנות ארגון הפיקוח על העבודה (מסירת מידע והדרכת עובדים), בתוקף מ-16/10/2026,
-- דורש בפנקס ההדרכה את שם המדריך והכשירות שלו (לצד שם, ת.ז, תאריך ונושא, שכבר נשמרים).
-- הוספה בלבד. גיבוי לפני: backup_20261005.toolbox_talks (שורה אחת, נמדד 05/10/2026).
create schema if not exists backup_20261005;
create table if not exists backup_20261005.toolbox_talks as table public.toolbox_talks;
alter table public.toolbox_talks add column if not exists trainer text;
alter table public.toolbox_talks add column if not exists trainer_qual text;
-- הצילום של בדיקת העמודות החודשית מתעדכן (631 עמודות אחרי העדכון, 05/10/2026).
UPDATE public.server_state SET value = (
  select coalesce(jsonb_agg(c order by c), '[]'::jsonb)::text
    from (select table_name || '.' || column_name as c from information_schema.columns where table_schema = 'public') x
), updated_at = now() WHERE key = 'db_columns_snapshot';
