-- סריקת אבטחה 10/10/2026, BACKLOG 13.5 (מיכאל בשאלון: "בצע: הגבלת היסטוריה").
-- trustee_reports קריא לכל session אנונימי (emp_select USING (true)), כי ממשק הנאמנים
-- הוא session אנונימי בלי זהות. אי אפשר לאכוף "רק הדיווחים שלי" במסד, אבל אפשר לצמצם
-- את ההיסטוריה: session אנונימי רואה רק דיווחים מ-90 הימים האחרונים, וליקויים שעדיין
-- פתוחים (רשימת "שלי שעדיין פתוחים" בממשק). משתמש מחובר (מיכאל, מנהל, צופה) רואה הכל.
-- הוספה בלבד: policy מגבילה (RESTRICTIVE) חדשה. שום policy קיימת לא נמחקת ולא משתנה.
-- נמדד 10/10/2026: 18 דיווחים, 23/09-08/10/2026, 0 מוסתרים היום.

CREATE SCHEMA IF NOT EXISTS backup_20261010;
CREATE TABLE IF NOT EXISTS backup_20261010.trustee_reports AS TABLE public.trustee_reports;
REVOKE ALL ON SCHEMA backup_20261010 FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA backup_20261010 FROM anon, authenticated;

CREATE POLICY kiosk_window ON public.trustee_reports AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    OR d >= current_date - 90
    OR (ok = false AND s IS DISTINCT FROM 'נסגר')
  );

CREATE INDEX IF NOT EXISTS trustee_reports_d_idx ON public.trustee_reports (d);
