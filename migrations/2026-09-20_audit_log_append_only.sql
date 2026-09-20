-- 2026-09-20 — יומן הביקורת הופך לראיה: הוספה בלבד
--
-- BACKLOG 5.8. ⚠ **משנה policy קיימת** — לפי CLAUDE.md זו פעולה שדורשת
-- אישור מפורש שלך, בכל פעם. **טרם הורצה.**
--
-- ## למה
--
-- migrations/2026-04-24_audit_log.sql שורה 46:
--
--     CREATE POLICY audit_log_admin_manager_all ON audit_log
--       FOR ALL TO authenticated
--       USING (public.is_admin_manager())
--       WITH CHECK (public.is_admin_manager());
--
-- `FOR ALL` כולל UPDATE ו-DELETE. זו המיגרציה היחידה שנוגעת ב-audit_log —
-- אין אחריה שום policy שמצמצמת אותה.
--
-- כלומר: כל מי שיש לו role «מנהל» או «אדמין» יכול, מהדפדפן, לשלוח
-- `DELETE /rest/v1/audit_log?id=eq.N`, או `PATCH` שמשנה `user_email`, `op`
-- או `ts` — ולמחוק או לשכתב בדיוק את השורה שמתעדת מה הוא עשה.
--
-- ומכיוון שהקוד מוציא את audit_log מהרישום של עצמו
-- (index.html: `if(tbl==='audit_log')return;`), מחיקת שורת יומן לא מייצרת
-- שורת יומן.
--
-- בביקורת ISO 45001 / 14001 זה ההבדל בין «יומן שינויים» לבין «רשימה שאפשר
-- לערוך»: אין דרך להוכיח שמה שרשום הוא מה שקרה.
--
-- ## למה זה בטוח לקוד
--
-- אומת: האפליקציה **לעולם** לא מעדכנת ולא מוחקת audit_log.
--   * `_aud()` דוחף אך ורק `{op:'ins'}`
--   * `rAudit()` רק קורא (`select=*&order=ts.desc&limit=200`)
--   * הייצוא רק קורא
--   * אין אף `sbUpd('audit_log', …)` ואין אף `askDel('audit_log', …)`
-- לכן הסרת UPDATE/DELETE לא שוברת שום זרימה קיימת.
--
-- ## מה זה עושה
--
-- מחליף policy אחת רחבה בשתיים צרות: קריאה למנהל/אדמין, כתיבה = INSERT בלבד.
-- אין DROP TABLE, אין DELETE, אף שורה לא נוגעים בה.

BEGIN;

-- הקריאה — בדיוק כמו קודם.
DROP POLICY IF EXISTS audit_log_admin_manager_all ON public.audit_log;

CREATE POLICY audit_log_admin_manager_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin_manager());

-- ההוספה — כל משתמש מאומת, כמו היום (policy זה כבר קיים מ-2026-04-24;
-- נוצר כאן רק אם אינו קיים, כדי שהקובץ יהיה בטוח לחזור עליו).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='audit_log'
      AND policyname='audit_log_authenticated_insert'
  ) THEN
    EXECUTE 'CREATE POLICY audit_log_authenticated_insert ON public.audit_log
               FOR INSERT TO authenticated WITH CHECK (true)';
  END IF;
END $$;

-- ואין policy ל-UPDATE ול-DELETE. בלי policy, RLS אוסר.

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- אימות — להדביק אחרי ההרצה
-- ============================================================
-- (1) אילו policies נשארו, ולאיזו פעולה. צפוי: SELECT + INSERT בלבד.
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname='public' AND tablename='audit_log'
-- ORDER BY policyname;
--
-- (2) שהמחיקה באמת חסומה — בתוך טרנזקציה שנסגרת ב-ROLLBACK.
--     צפוי: 0 שורות נמחקו (RLS מסנן, לא זורק שגיאה).
-- BEGIN;
--   WITH d AS (DELETE FROM public.audit_log
--              WHERE id=(SELECT id FROM public.audit_log LIMIT 1)
--              RETURNING 1)
--   SELECT count(*) AS deleted FROM d;
-- ROLLBACK;
--
-- (3) שההוספה עדיין עובדת — האפליקציה תלויה בזה.
-- BEGIN;
--   INSERT INTO public.audit_log (id, user_email, op, table_name, ts)
--   VALUES ('test-'||gen_random_uuid(), 'verify@test', 'INSERT', 'docs', now())
--   RETURNING id;
-- ROLLBACK;

-- ============================================================
-- אחרי ההרצה — בדיקה באפליקציה לפני שמסמנים ✅ ב-STATUS.md
-- ============================================================
--  [ ] לשמור רשומה כלשהי (למשל הדרכה) → דף יומן הביקורת מציג את השורה החדשה
--  [ ] דף יומן הביקורת נטען ומציג היסטוריה כרגיל
--  [ ] ייצוא היומן ל-CSV עובד
--
-- רולבק (מחזיר את החור):
--   DROP POLICY IF EXISTS audit_log_admin_manager_select ON public.audit_log;
--   CREATE POLICY audit_log_admin_manager_all ON public.audit_log
--     FOR ALL TO authenticated
--     USING (public.is_admin_manager())
--     WITH CHECK (public.is_admin_manager());
