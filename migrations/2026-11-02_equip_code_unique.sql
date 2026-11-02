-- 02/11/2026: קוד ציוד אחד לכל שורה ב-equip_inspections (מיכאל בשאלון: "בצע: רק לקוד (מומלץ)", רטרו 28/10/2026 (ב)).
-- שתי בקשות equip_add באותו רגע עברו שתיהן את בדיקת הכפילות בשרת. אינדקס ייחודי על הקוד, בלי הבדל אותיות ורווחים,
-- רק לשורות עם קוד אמיתי (לא ריק, לא "?" ולא "-", שהסריקה כותבת כשאין קוד). מספר תסקיר לא נכלל: יש בו כפילות אחת קיימת.
-- גיבוי לפני: backup_equip_20261102.equip_inspections (90 = 90, הפרש 0, נמדד 02/11/2026). אין שינוי בשורות.
CREATE UNIQUE INDEX IF NOT EXISTS equip_inspections_code_uq ON public.equip_inspections (lower(btrim(code)))
  WHERE code IS NOT NULL AND btrim(code) NOT IN ('', '?', '-');
-- rollback: DROP INDEX IF EXISTS public.equip_inspections_code_uq;
