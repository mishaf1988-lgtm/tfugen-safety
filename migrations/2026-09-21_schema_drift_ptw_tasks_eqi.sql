-- 2026-09-21 — עשר עמודות שהאפליקציה שומרת ושלא היו קיימות
--
-- נמצאו על ידי `tests/harness/schema-drift-test.js`, שנכתבה היום: היא מריצה את
-- פונקציות השמירה בדפדפן, לוכדת את השדות שהן שולחות בפועל, ומשווה לסכמה החיה.
-- זו הבדיקה הראשונה בפרויקט שמסוגלת לראות את הפער הזה — ההארנס תמיד רץ מול
-- `sbIns`/`sbUpd` מדומים ולא ידע מה באמת קיים בשרת.
--
-- ## למה זה לא התגלה עד היום
--
-- כששדה לא קיים, **שום דבר לא נכשל**. PostgREST מחזיר PGRST204, `_obSend`
-- מוחק את המפתח הזה ושולח שוב, הרשומה נשמרת בלעדיו, ומאז #654 מוצגת הודעה
-- כתומה — פעם אחת, בטלפון, בזמן שמקלידים את הרשומה הבאה.
--
-- ## PTW — היתר עבודה
--
-- הכי חמור מבין השישה. היתר עבודה הוא מסמך בטיחות שמסתמכים עליו בשטח:
--
--   * `desc`  — **תיאור העבודה**. השדה המרכזי בטופס. לא נשמר.
--   * `s`     — **סטטוס ההיתר** (פתוח/סגור/בוטל). לא נשמר.
--   * `sg2n`, `sg2d`, `sg3n`, `sg3d`, `sg4n`, `sg4d` — **חתימות 2, 3 ו-4**.
--     בטבלה קיימת רק `sg1n`/`sg1d`. כלומר מתוך ארבע החתימות שהטופס אוסף,
--     שלוש נעלמות. היתר שנראה חתום על המסך מגיע לשרת עם חתימה אחת.
--
-- `desc` היא מילה שמורה ב-Postgres (DESC), ולכן חייבת מרכאות כפולות.
-- PostgREST מטפל בעמודה מצוטטת כרגיל.
--
-- ## tasks.closed_date — תאריך סגירת משימה
--
-- נכתב ב-index.html כשמשימה עוברת ל«הושלם», ונקרא בארבעה מקומות: שני
-- אינדיקטורי הדשבורד, סקירת ההנהלה, והגרף «נסגרו בזמן» שנוסף ב-#666 (פריט
-- 6.10). כל אלה נפלו חזרה ל-`ts` או הציגו אפס.
--
-- ## equip_inspections.attachments — קבצים מצורפים לבדיקת ציוד

ALTER TABLE public.ptw ADD COLUMN IF NOT EXISTS "desc" text;
ALTER TABLE public.ptw ADD COLUMN IF NOT EXISTS s     text;
ALTER TABLE public.ptw ADD COLUMN IF NOT EXISTS sg2n  text;
ALTER TABLE public.ptw ADD COLUMN IF NOT EXISTS sg2d  text;
ALTER TABLE public.ptw ADD COLUMN IF NOT EXISTS sg3n  text;
ALTER TABLE public.ptw ADD COLUMN IF NOT EXISTS sg3d  text;
ALTER TABLE public.ptw ADD COLUMN IF NOT EXISTS sg4n  text;
ALTER TABLE public.ptw ADD COLUMN IF NOT EXISTS sg4d  text;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS closed_date date;

-- הלקוח שולח מערך של קישורים (`_eqiFiles.slice()`), לכן jsonb ולא text.
ALTER TABLE public.equip_inspections ADD COLUMN IF NOT EXISTS attachments jsonb;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- אימות — צריך להחזיר 10 שורות
-- ============================================================
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema='public'
--   AND (   (table_name='ptw'   AND column_name IN ('desc','s','sg2n','sg2d','sg3n','sg3d','sg4n','sg4d'))
--        OR (table_name='tasks' AND column_name='closed_date')
--        OR (table_name='equip_inspections' AND column_name='attachments'))
-- ORDER BY table_name, column_name;
--
-- ============================================================
-- רולבק
-- ============================================================
-- DROP COLUMN הוא פעולה הרסנית לפי CLAUDE.md ודורש אישור מפורש. הוא ימחק גם
-- כל היתר עבודה וכל תאריך סגירה שנשמרו מאז ההרצה.
--
-- ALTER TABLE public.ptw DROP COLUMN IF EXISTS "desc";
-- ALTER TABLE public.ptw DROP COLUMN IF EXISTS s;
-- ALTER TABLE public.ptw DROP COLUMN IF EXISTS sg2n;
-- ALTER TABLE public.ptw DROP COLUMN IF EXISTS sg2d;
-- ALTER TABLE public.ptw DROP COLUMN IF EXISTS sg3n;
-- ALTER TABLE public.ptw DROP COLUMN IF EXISTS sg3d;
-- ALTER TABLE public.ptw DROP COLUMN IF EXISTS sg4n;
-- ALTER TABLE public.ptw DROP COLUMN IF EXISTS sg4d;
-- ALTER TABLE public.tasks DROP COLUMN IF EXISTS closed_date;
-- ALTER TABLE public.equip_inspections DROP COLUMN IF EXISTS attachments;
-- NOTIFY pgrst, 'reload schema';
