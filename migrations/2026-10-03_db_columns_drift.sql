-- מיכאל, 03/10/2026 (אפשרות 1): בדיקה חודשית של עמודות המסד, בתוך המסד, בלי Routine.
-- מנגנון ה-self-heal של PGRST204 מוחק בשקט שדה שאין לו עמודה (כך אבד ncr.src_date).
-- tests/harness/db-columns.json תופס את זה בבדיקות, אבל רק כל עוד הוא תואם למסד.
-- server_state:
--   db_columns_snapshot = רשימת "טבלה.עמודה" שאושרה (נוצרת בהרצה הראשונה)
--   db_columns_drift    = {at, added, removed} מההשוואה האחרונה; המייל השבועי מציג שורה כשלא ריק
-- הפונקציה לא מעדכנת את הצילום בעצמה: שינוי שנעשה בטעות לא יאושר אוטומטית (הערת הסשן השני).
-- אחרי שמיכאל מאשר שינוי: לעדכן את db_columns_snapshot ואת tests/harness/db-columns.json באותו PR.
-- הוספה בלבד: פונקציה חדשה ומשימת cron חדשה, בלי שינוי בטבלאות.

CREATE OR REPLACE FUNCTION private.db_columns_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare cur jsonb; snap jsonb; added jsonb; removed jsonb; res jsonb;
begin
  select coalesce(jsonb_agg(c order by c), '[]'::jsonb) into cur
    from (select table_name || '.' || column_name as c
            from information_schema.columns where table_schema = 'public') x;
  select value::jsonb into snap from public.server_state where key = 'db_columns_snapshot';
  if snap is null then
    insert into public.server_state(key, value, updated_at) values ('db_columns_snapshot', cur::text, now())
      on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
    snap := cur;
  end if;
  select coalesce(jsonb_agg(e order by e), '[]'::jsonb) into added
    from jsonb_array_elements_text(cur) e where not snap ? e;
  select coalesce(jsonb_agg(e order by e), '[]'::jsonb) into removed
    from jsonb_array_elements_text(snap) e where not cur ? e;
  res := jsonb_build_object('at', now(), 'added', added, 'removed', removed);
  insert into public.server_state(key, value, updated_at) values ('db_columns_drift', res::text, now())
    on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  return res;
end
$function$;

REVOKE EXECUTE ON FUNCTION private.db_columns_check() FROM PUBLIC, anon, authenticated;

-- ב-1 לכל חודש, 02:41 UTC (05:41 שעון ישראל בקיץ), לפני המייל של יום ראשון.
SELECT cron.schedule('db-columns-check', '41 2 1 * *', 'select private.db_columns_check()');

-- rollback: SELECT cron.unschedule('db-columns-check'); DROP FUNCTION IF EXISTS private.db_columns_check();
--           DELETE FROM public.server_state WHERE key IN ('db_columns_snapshot','db_columns_drift');
