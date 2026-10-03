-- מתי נוצר הקישור האחרון לעובדים של כל הדרכה שבועית (03/10/2026).
-- מיכאל בחר בדרך א (עמודה ולא חישוב מתאריך ההדרכה): הקישור בתוקף 14 ימים
-- (TALK_TTL_DAYS ב-talk.js), והתוקף היה שמור רק בתוך הטוקן. talk.js כותב כאן
-- בכל יצירת קישור, והמייל השבועי מזהיר כשהקישור פג לפני המייל הבא ועדיין
-- חתמו פחות מ-80%. הטבלה מציגה "קישור עד".
-- הוספת עמודה בלבד, ריקה בשורות הקיימות. ה-RLS וה-policies לא משתנים.
ALTER TABLE public.toolbox_talks ADD COLUMN IF NOT EXISTS link_at timestamptz;
-- הצילום של בדיקת העמודות החודשית (db_columns_check) מתעדכן, כדי שהעמודה לא תדווח כשינוי לא מאושר.
UPDATE public.server_state SET value = (
  select coalesce(jsonb_agg(c order by c), '[]'::jsonb)::text
    from (select table_name || '.' || column_name as c from information_schema.columns where table_schema = 'public') x
), updated_at = now() WHERE key = 'db_columns_snapshot';
