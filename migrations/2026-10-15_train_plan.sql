-- 15/10/2026: תכנית ההדרכות השנתית (טופס 08.01, נוהל 8 סעיף 5.4) כמסך.
-- מיכאל בשאלון: "בצע: כל 30", "בצע: אוטומטי + ידני", "בצע: רבעון יעד לכל סעיף", "בצע: מסך + PDF של 08.01".
-- שורה לכל סעיף בתכנית של שנה:
--   yr, n    שנה ומספר הסעיף בטופס (ייחודי יחד)
--   t        נושא ההדרכה        who  המדריך (כמו בטופס)     aud  קהל היעד
--   q        רבעוני היעד, "1,3" (ריק = עוד לא שובץ)
--   done     ביצוע ידני: [{"d":"YYYY-MM-DD","by":"מדריך","file_url":"...","note":"..."}]
-- ביצוע אוטומטי לא נשמר כאן: האפליקציה מחשבת אותו מהדרכה שנתית או הדרכת איכות שנסגרה
-- (toolbox_talks.kind, subjects, closed_at). טבלה חדשה, הוספה בלבד. הרשאות כמו toolbox_talks.

CREATE TABLE IF NOT EXISTS public.train_plan (
  id   text PRIMARY KEY,
  yr   integer NOT NULL,
  n    integer NOT NULL,
  t    text NOT NULL,
  who  text,
  aud  text,
  q    text,
  done jsonb NOT NULL DEFAULT '[]'::jsonb,
  ts   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (yr, n)
);

ALTER TABLE public.train_plan ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.train_plan FROM anon;
CREATE POLICY train_plan_admin_manager_all ON public.train_plan FOR ALL TO authenticated
  USING ((SELECT private.is_admin_manager())) WITH CHECK ((SELECT private.is_admin_manager()));
CREATE POLICY viewer_read ON public.train_plan FOR SELECT TO authenticated USING ((SELECT private.is_viewer()));
CREATE POLICY viewer_no_insert ON public.train_plan AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT (SELECT private.is_viewer()));
CREATE POLICY viewer_no_update ON public.train_plan AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT (SELECT private.is_viewer()));
CREATE POLICY viewer_no_delete ON public.train_plan AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT (SELECT private.is_viewer()));
CREATE POLICY mfa_required ON public.train_plan AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.mfa_ok())) WITH CHECK ((SELECT private.mfa_ok()));
CREATE POLICY pwchange_required ON public.train_plan AS RESTRICTIVE FOR ALL TO authenticated
  USING (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'must_change_password')::boolean, false) = false)
  WITH CHECK (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'must_change_password')::boolean, false) = false);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.train_plan TO authenticated;
