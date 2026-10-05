-- 05/10/2026: בדיקת אפקטיביות להדרכה השבועית, כמו בטופס הנייר 08.01 ("נדרשת: כן/לא, אפקטיבי: כן/לא,
-- תאריך, תאור הבדיקה, המשך טיפול, חתימה"). ISO 45001 7.2: הערכת יעילות ההדרכה. מיכאל: "מאשר את שניהם".
-- הוספה בלבד. toolbox_talks גובתה היום (backup_20261005.toolbox_talks).
alter table public.toolbox_talks add column if not exists eff_req boolean;
alter table public.toolbox_talks add column if not exists eff_ok boolean;
alter table public.toolbox_talks add column if not exists eff_d date;
alter table public.toolbox_talks add column if not exists eff_desc text;
alter table public.toolbox_talks add column if not exists eff_next text;
alter table public.toolbox_talks add column if not exists eff_by text;
UPDATE public.server_state SET value = (
  select coalesce(jsonb_agg(c order by c), '[]'::jsonb)::text
    from (select table_name || '.' || column_name as c from information_schema.columns where table_schema = 'public') x
), updated_at = now() WHERE key = 'db_columns_snapshot';
