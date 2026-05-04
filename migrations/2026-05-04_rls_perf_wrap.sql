-- migrations/2026-05-04_rls_perf_wrap.sql
-- =====================================================================
-- Phase 4 — RLS performance wrap
-- =====================================================================
--
-- מטרה: לעטוף כל קריאה ל-public.is_admin_manager() בתוך policies קיימות
-- ב-(select ...) כדי שהפונקציה תרוץ פעם אחת לכל query (initPlan), במקום
-- פעם לכל row. בטבלאות עם 100+ שורות זה יכול לתת עד ~100x שיפור על
-- שאילתות RLS-bound. אין שינוי תוצאות, רק שיפור ביצועים.
--
-- מקור: Supabase RLS performance docs (קישור ב-PERFORMANCE-PLAN-2026-05-04.md).
-- בטוח לחזרה: ה-DO block עובר רק על policies שמכילות את הטקסט
-- 'is_admin_manager()' ולא את הצורה העטופה כבר '(select is_admin_manager())'.
-- אפשר להריץ שוב בלי תופעות לוואי.
--
-- תוספת: event trigger pgrst_watch שמודיע ל-PostgREST לרענן schema cache
-- אוטומטית אחרי DDL, כדי למנוע PGRST204 אחרי migrations עתידיות.
--
-- אימות אחרי הרצה:
--   1. SELECT count(*) FROM pg_policies
--      WHERE schemaname='public' AND qual LIKE '%is_admin_manager()%'
--      AND qual NOT LIKE '%(select is_admin_manager())%';
--      → אמור להחזיר 0
--   2. SELECT count(*) FROM ncr;  -- כ-admin
--      → אמור לחזור מהיר יותר (במיוחד אחרי VACUUM ANALYZE)
--   3. SELECT * FROM pg_event_trigger WHERE evtname='pgrst_watch';
--      → שורה אחת, evtenabled='O'
-- =====================================================================

-- 1) עטיפת is_admin_manager() ב-(select ...) בכל ה-policies הקיימות
--    תומך גם ב-schema-qualified calls כמו public.is_admin_manager() / private.is_admin_manager()
DO $$
DECLARE
  r RECORD;
  new_qual TEXT;
  new_check TEXT;
  using_clause TEXT;
  check_clause TEXT;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check, cmd, roles
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        -- מחפש את שם הפונקציה אבל לא בתוך select כבר עטוף
        (qual ~ 'is_admin_manager\(\)' AND qual !~ '\(\s*select[^\)]*is_admin_manager\(\)')
        OR
        (with_check ~ 'is_admin_manager\(\)' AND with_check !~ '\(\s*select[^\)]*is_admin_manager\(\)')
      )
  LOOP
    -- בנה USING clause חדש (אם יש qual) — regex תופס schema prefix אופציונלי
    -- דוגמאות: is_admin_manager() → (select is_admin_manager())
    --          public.is_admin_manager() → (select public.is_admin_manager())
    --          private.is_admin_manager() → (select private.is_admin_manager())
    IF r.qual IS NOT NULL THEN
      new_qual := regexp_replace(r.qual, '(\m\w+\.)?is_admin_manager\(\)', '(select \1is_admin_manager())', 'g');
      using_clause := format(' USING (%s)', new_qual);
    ELSE
      using_clause := '';
    END IF;

    -- בנה WITH CHECK clause חדש (אם יש with_check)
    IF r.with_check IS NOT NULL THEN
      new_check := regexp_replace(r.with_check, '(\m\w+\.)?is_admin_manager\(\)', '(select \1is_admin_manager())', 'g');
      check_clause := format(' WITH CHECK (%s)', new_check);
    ELSE
      check_clause := '';
    END IF;

    -- ALTER POLICY תומך רק ב-USING ו-WITH CHECK (לא משנה cmd/roles, נשמרים)
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I%s%s',
      r.policyname, r.schemaname, r.tablename, using_clause, check_clause
    );

    RAISE NOTICE 'Wrapped policy: %.% / %', r.schemaname, r.tablename, r.policyname;
  END LOOP;
END $$;

-- 2) Event trigger ל-NOTIFY pgrst אוטומטי אחרי DDL
CREATE OR REPLACE FUNCTION public.pgrst_watch()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

DROP EVENT TRIGGER IF EXISTS pgrst_watch;
CREATE EVENT TRIGGER pgrst_watch
  ON ddl_command_end
  EXECUTE FUNCTION public.pgrst_watch();

-- 3) רענון מיידי של schema cache
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- סוף migration. אין צורך ב-rollback — אם משהו לא מתנהג כצפוי, אפשר:
--   ALTER POLICY <name> ON <table> USING (is_admin_manager()) WITH CHECK (is_admin_manager());
-- כדי לחזור לצורה הלא-עטופה. אבל אין סיבה לעשות זאת — הפונקציה זהה.
-- =====================================================================
