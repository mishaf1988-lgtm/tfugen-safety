-- 20/10/2026: עמודת "אחראי" (תחום) לציוד.
-- מיכאל בשאלון (20/10/2026): נרשם תחום, לא שם אדם. מי אחראי על כל תחום יושב במקום אחד,
-- SITE.equipAreas ב-functions/_site.js (עובד מתחלף = שורה אחת). ריק = באחריות ממונה הבטיחות.
-- מוצג במייל השבועי ובמסך התפוגות. פריט של תחום אחר שפג: רק מסומן, בלי טיוטה אוטומטית.
-- הוספה בלבד. גיבוי לפני: backup_20261020.equip_inspections (88 שורות, נמדד 20/10/2026).
create schema if not exists backup_20261020;
create table if not exists backup_20261020.equip_inspections as table public.equip_inspections;
alter table public.equip_inspections add column if not exists resp_area text;
-- מילוי ראשון: ציוד האמוניה (agent-common.md, "ציוד אמוניה ותשתיות"). השאר לפי תשובת מיכאל.
update public.equip_inspections set resp_area = 'תשתיות ואמוניה'
 where resp_area is null and id in ('aud1010vario','417b744ab6bc','xl1008-e68','xl1008-e36','aud1010nh3vs','xl1008-e90','aud1010nh3wt','xl1008-e91');
-- הצילום של בדיקת העמודות החודשית מתעדכן.
UPDATE public.server_state SET value = (
  select coalesce(jsonb_agg(c order by c), '[]'::jsonb)::text
    from (select table_name || '.' || column_name as c from information_schema.columns where table_schema = 'public') x
), updated_at = now() WHERE key = 'db_columns_snapshot';
