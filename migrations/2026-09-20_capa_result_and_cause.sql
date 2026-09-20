-- 2026-09-20 — תוצאת אימות אפקטיביות, קריטריון הצלחה, וקטגוריית סיבת שורש
--
-- BACKLOG 1.7 + 1.11 (+ פער שנמצא ב-#674). מריצים ב-Supabase → SQL Editor.
-- בטוח לחזור עליו: הכל ADD COLUMN IF NOT EXISTS, שום שורה קיימת לא נוגעת.
--
-- ## למה
--
-- ### 1.7 — אין איפה לרשום שהפעולה המתקנת לא עבדה
--
-- `migrations/2026-05-01_ncr_capa_verify.sql` הוסיף בדיוק שלוש עמודות:
-- `verified_by`, `verified_at`, `verification_notes`. **אין שדה תוצאה.**
-- לכן עצם קיום החתימה = «עבר»: `_capaDue` מסנן ב-`if(r.verified_by)return false;`
-- ו-`showView` צובע ירוק על אותו תנאי בדיוק.
--
-- כלומר כשהפעולה המתקנת **לא** עבדה, נשארו שתי אפשרויות:
--   * לא ללחוץ על הכפתור — וה-NCR יושב לנצח ב«ממתינות לאימות» ונראה כהזנחה;
--   * ללחוץ «אמת» ולכתוב «לא עבד» בטקסט החופשי — ואז הוא ירוק בכל מסך,
--     כולל בדוח המוכנות לביקורת שמבקר ISO קורא.
--
-- ובלי קריטריון הצלחה שנקבע **בזמן הסגירה**, האימות אחרי 30 יום הוא שאלת
-- זיכרון («נראה לי שזה בסדר») ולא מדידה — וזה בדיוק מה ש-§10.2.1e דורש
-- שיהיה מתועד.
--
-- ### 1.11 — סיבת השורש היא 375 מחרוזות חופשיות
--
-- «מה הסיבה הכי שכיחה לאי-התאמות אצלכם?» היא שאלה שמבקר ISO פותח בה.
-- `ncr.rc` הוא input חופשי, ואין שום שדה קטגוריה באף מיגרציה. אי אפשר
-- לספור «12 מתוכן היו כשל בנוהל» בלי לקרוא 375 רשומות ביד, ואי אפשר
-- להראות מגמה — שזה מה ש-§10.2 מצפה לו.
--
-- `issue_types` כבר קיים אבל הוא מסווג את ה**תסמין** (החלקות → שמן על
-- הרצפה), לא את ה**סיבה** (אדם/נוהל/ציוד/סביבה/ניהול). לכן זה מימד שני
-- ולא שכפול שלו.
--
-- ### near_miss.ncr_id — פער שנמצא אגב #674
--
-- PR #662 כותב `nm.ncr_id` כשמשרשרים כמעט-ונפגע ל-NCR, ואין עמודה כזו.
-- PostgREST מחזיר PGRST204, הלקוח מוחק את השדה ושולח שוב (מ-#654 עם
-- אזהרה), והקישור נשאר מקומי למכשיר שביצע את השרשור בלבד.
--
-- הקוד של #674 **לא תלוי** בעמודה — הוא קורא את מספר ה-NCR מתוך
-- `nm.notes`, שכן מסונכרן. אחרי שהמיגרציה תרוץ הקישור יהיה גם מזהה ישיר.
--
-- ## מה זה עושה
--
-- ארבע עמודות טקסט חדשות. אין שינוי RLS, אין DROP, אין DELETE, אין
-- נגיעה בשורות קיימות — כולן נוצרות NULL.

ALTER TABLE public.ncr       ADD COLUMN IF NOT EXISTS verification_result text;
ALTER TABLE public.ncr       ADD COLUMN IF NOT EXISTS success_criteria    text;
ALTER TABLE public.ncr       ADD COLUMN IF NOT EXISTS rc_cat              text;
ALTER TABLE public.near_miss ADD COLUMN IF NOT EXISTS ncr_id              text;

-- מועיל כש-«לפי סיבה» יגדל מעבר ל-375 רשומות; לא חובה.
CREATE INDEX IF NOT EXISTS ncr_rc_cat_idx ON public.ncr(rc_cat);

-- PostgREST מחזיק cache של הסכמה. בלי זה הוא ימשיך להחזיר PGRST204
-- עד ה-reload הבא.
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- אימות — להדביק אחרי ההרצה. צריך להחזיר ארבע שורות.
-- ============================================================
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND (   (table_name = 'ncr'       AND column_name IN ('verification_result','success_criteria','rc_cat'))
--        OR (table_name = 'near_miss' AND column_name = 'ncr_id'))
-- ORDER BY table_name, column_name;
--
-- ובדיקה שאף שורה לא נפגעה (המספר צריך להישאר 375 או מה שיש היום):
-- SELECT count(*) AS ncr_rows FROM public.ncr;
--
-- ============================================================
-- רולבק
-- ============================================================
-- שים לב: ALTER ... DROP COLUMN הוא פעולה הרסנית לפי CLAUDE.md ודורש
-- אישור מפורש. הוא מוחק גם את הערכים שנכתבו לעמודות מאז ההרצה.
--
-- ALTER TABLE public.ncr       DROP COLUMN IF EXISTS verification_result;
-- ALTER TABLE public.ncr       DROP COLUMN IF EXISTS success_criteria;
-- ALTER TABLE public.ncr       DROP COLUMN IF EXISTS rc_cat;
-- ALTER TABLE public.near_miss DROP COLUMN IF EXISTS ncr_id;
-- DROP INDEX IF EXISTS public.ncr_rc_cat_idx;
-- NOTIFY pgrst, 'reload schema';
