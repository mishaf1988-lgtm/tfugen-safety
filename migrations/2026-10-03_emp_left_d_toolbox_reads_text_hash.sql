-- שתי עמודות להדרכה השבועית (03/10/2026, מיכאל בשאלון: "סטטוס עזב" ו-"hash כן").
-- emp.left_d: תאריך עזיבה. ריק = עובד פעיל. מי שעזב לא מופיע ברשימת השמות בדף
--   החתימה ולא נספר ב"לא חתמו", והחתימות הישנות שלו נשמרות כראיה.
-- toolbox_reads.text_hash: SHA-256 של הנוסח שהעובד ראה כשחתם (השפה, הנושא, התוכן
--   והקובץ). כשההדרכה נערכת אחר כך, "מי חתם" מסמן מי חתם על נוסח קודם.
-- הוספת עמודות בלבד. ה-RLS וה-policies לא משתנים.
ALTER TABLE public.emp ADD COLUMN IF NOT EXISTS left_d date;
ALTER TABLE public.toolbox_reads ADD COLUMN IF NOT EXISTS text_hash text;
-- הצילום של בדיקת העמודות החודשית מתעדכן, כדי ששתי העמודות לא ידווחו כשינוי לא מאושר.
UPDATE public.server_state SET value = (
  select coalesce(jsonb_agg(c order by c), '[]'::jsonb)::text
    from (select table_name || '.' || column_name as c from information_schema.columns where table_schema = 'public') x
), updated_at = now() WHERE key = 'db_columns_snapshot';
