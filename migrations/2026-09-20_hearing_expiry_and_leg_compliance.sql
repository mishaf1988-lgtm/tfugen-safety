-- 2026-09-20 — תוקף לבדיקות שמיעה, ורשומת הערכת ציות למאגר החוקי
--
-- BACKLOG 3.5 + 3.7. מריצים ב-Supabase → SQL Editor. בטוח לחזור עליו:
-- הכל ADD COLUMN IF NOT EXISTS, שום שורה קיימת לא נוגעת, אין DROP ואין DELETE.
--
-- ## 3.5 — למרשם בדיקות השמיעה אין בכלל שדה תוקף
--
-- הסכמה (`migrations/2026-04-20_hearing_tests.sql`) היא:
-- `id, emp_name, emp_id, dob, age, gender, role, dept, category, year,
--  notes, test_date, inspector, ts` — **אין `e`**. המיגרציה היחידה שנגעה
-- בטבלה מאז הוסיפה `location_id` בלבד.
--
-- התוצאה: זהו מרשם מעקב רפואי **סטטוטורי** שלא נסרק בדף התפוגות, לא
-- מופיע בלוח השנה, לא נכנס ל-ICS, ולא מייצר את ההתראה «פג בעוד 30 יום».
-- `rHearing` הדפיס את תאריך הבדיקה עם `fd()` בלי `eb()` — כלומר **אין ולו
-- באדג' צבע אחד בכל העמוד**. עובד שבדיקת השמיעה שלו פגה לפני שנה נראה
-- בדיוק כמו עובד שנבדק אתמול.
--
-- שים לב: **התדירות לא מקודדת כאן ולא בקוד.** היא נקבעת בתקנות ולפי רמת
-- החשיפה, ואני לא ממציא אותה. הקוד מוסיף כפתור «מלא תפוגות» שמבקש ממך את
-- מספר החודשים ומחשב תאריך בדיקה + N — ורק לשורות שאין להן תפוגה.
--
-- ## 3.7 — «סטטוס עמידה» הוא dropdown בלי תאריך, בלי מי קבע ובלי ראיה
--
-- `leg-c` הוא `<select>` עם ארבע אופציות, ו-`svLeg` כותב `c:gv('leg-c')`
-- ותו לא. אין טבלת היסטוריה, אין אזור צירוף במודאל, ואין `file_url`
-- ל-`leg` באף מיגרציה.
--
-- «סקירה אחרונה» (`last_review`) **כן** קיים — אבל הוא שדה נפרד שמיכאל
-- מקליד ביד, ואין שום קשר בינו לבין `c`. כלומר אפשר להפוך «אינו מציית»
-- ל«מציית» ותאריך הסקירה יישאר של לפני שנה, כשהבאדג' «✅ בעוד 340 ימים»
-- יושב לידו ונראה כאילו הוא מגבה את הקביעה.
--
-- מול מבקר ISO ששואל §9.1.2 «על סמך מה קבעתם», התשובה הייתה dropdown.
--
-- מ-PR זה `c_date` ו-`c_by` נכתבים **על ידי הקוד** כשהסטטוס משתנה, ולא
-- מוקלדים — שדה שצריך לזכור לעדכן הוא שדה שנשאר לא מעודכן. עריכת התקציר
-- של חוק לא מאפסת את התאריך; רק שינוי הסטטוס עצמו.
--
-- ## מה זה עושה

ALTER TABLE public.hearing_tests ADD COLUMN IF NOT EXISTS e date;

ALTER TABLE public.leg ADD COLUMN IF NOT EXISTS c_date         date;
ALTER TABLE public.leg ADD COLUMN IF NOT EXISTS c_by           text;
ALTER TABLE public.leg ADD COLUMN IF NOT EXISTS c_evidence_url text;

-- PostgREST מחזיק cache של הסכמה. בלי זה הוא ימשיך להחזיר PGRST204
-- עד ה-reload הבא.
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- אימות — להדביק אחרי ההרצה. צריך להחזיר ארבע שורות.
-- ============================================================
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND (   (table_name = 'hearing_tests' AND column_name = 'e')
--        OR (table_name = 'leg' AND column_name IN ('c_date','c_by','c_evidence_url')))
-- ORDER BY table_name, column_name;
--
-- ובדיקה ששום שורה לא נפגעה:
-- SELECT (SELECT count(*) FROM public.hearing_tests) AS hearing_rows,
--        (SELECT count(*) FROM public.leg)           AS leg_rows;
--
-- כמה בדיקות שמיעה עדיין בלי תוקף (אחרי שתריץ «מלא תפוגות» זה אמור לרדת):
-- SELECT count(*) FROM public.hearing_tests WHERE e IS NULL;
--
-- ============================================================
-- רולבק
-- ============================================================
-- שים לב: ALTER ... DROP COLUMN הוא פעולה הרסנית לפי CLAUDE.md ודורש
-- אישור מפורש. הוא מוחק גם את הערכים שנכתבו מאז ההרצה — כולל תפוגות
-- שמילאת ידנית.
--
-- ALTER TABLE public.hearing_tests DROP COLUMN IF EXISTS e;
-- ALTER TABLE public.leg DROP COLUMN IF EXISTS c_date;
-- ALTER TABLE public.leg DROP COLUMN IF EXISTS c_by;
-- ALTER TABLE public.leg DROP COLUMN IF EXISTS c_evidence_url;
-- NOTIFY pgrst, 'reload schema';
