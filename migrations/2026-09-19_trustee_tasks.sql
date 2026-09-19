-- Trustee task catalogue (2026-09-19) — public.trustee_tasks
--
-- The 8 monthly tasks were a hardcoded array in index.html, so changing a
-- wording or adding a ninth task meant a code change. They live here now and
-- the manager edits them from the trustees page.
--
-- Columns: n the task number that trustee_reports.t stores · icon · t title ·
-- how the "what to do" text shown to the trustee · active (inactive = kept for
-- history and scoring, not offered in the report form).
--
-- n IS THE IDENTITY. Reports reference a task by its number, so a number must
-- never be reused for a different task — the app deactivates instead of
-- deleting, and refuses to delete a task that any report still points at.
--
-- TASK 8 IS STRUCTURAL, not an ordinary entry: a report with t=8 and a ref is
-- how a trustee closes a finding, and the trustee_reports trigger from
-- 2026-09-18 keys on exactly that. Its wording can change; its number cannot.
--
-- RLS — the same trust model as trustees / trustee_reports, one policy per command:
--   SELECT  any authenticated session (the anonymous trustee session needs the
--           catalogue to render the report form)
--   INSERT / UPDATE / DELETE  admin / manager only
--
-- Until this runs, the app falls back to the 8 tasks still built into
-- index.html, so nothing breaks while the table does not exist.
--
-- Idempotent: IF NOT EXISTS / DROP POLICY IF EXISTS / ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS public.trustee_tasks (
  id      text        PRIMARY KEY,
  n       smallint    NOT NULL UNIQUE,
  icon    text,
  t       text        NOT NULL,
  how     text,
  active  boolean     NOT NULL DEFAULT true,
  ts      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trustee_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trustee_tasks_read ON public.trustee_tasks;
CREATE POLICY trustee_tasks_read ON public.trustee_tasks
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS trustee_tasks_admin_manager_insert ON public.trustee_tasks;
CREATE POLICY trustee_tasks_admin_manager_insert ON public.trustee_tasks
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin_manager()));

DROP POLICY IF EXISTS trustee_tasks_admin_manager_update ON public.trustee_tasks;
CREATE POLICY trustee_tasks_admin_manager_update ON public.trustee_tasks
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin_manager()))
  WITH CHECK ((SELECT private.is_admin_manager()));

DROP POLICY IF EXISTS trustee_tasks_admin_manager_delete ON public.trustee_tasks;
CREATE POLICY trustee_tasks_admin_manager_delete ON public.trustee_tasks
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin_manager()));

-- Seed: exactly the 8 tasks index.html shipped with, copied verbatim so the
-- catalogue the trustees see does not change on the day this runs.
INSERT INTO public.trustee_tasks (id, n, icon, t, how) VALUES
  ('tsk_01', 1, '🔍', 'סיור מפגעים באזור', 'סיור אחד בחודש באזור שהוקצה לך. עוברים על כל המחלקה ומצלמים כל מפגע. גם אם לא נמצא כלום — מדווחים "סיור בוצע, אין ממצאים".'),
  ('tsk_02', 2, '🚿', 'מקלחות חירום ושטיפות עיניים', 'פותחים את המקלחת ואת שטיפת העיניים עד שהמים צלולים. בודקים לחץ, גישה פנויה במטר מסביב, שילוט קיים וניקוז עובד.'),
  ('tsk_03', 3, '🚪', 'דרכי מילוט ויציאות חירום', 'עוברים בכל מעבר ודלת חירום באזור: פנוי לגמרי, הדלת נפתחת בדחיפה אחת, שילוט המילוט ותאורת החירום דולקים.'),
  ('tsk_04', 4, '🪜', 'תקינות סולמות וגישה לגובה', 'כל סולם באזור: שלבים שלמים, רגליות גומי, מעצור פתיחה, ברגים מהודקים, מספר סולם מסומן. סולם פגום — תג אדום והוצאה מהשטח מיד. בודקים שעלייה למכלים ולאזורי גובה נעולה והמפתחות אצל השומר.'),
  ('tsk_05', 5, '🧯', 'עמדות כיבוי אש', 'מטפים, גלגלונים והידרנטים באזור: גישה פנויה, שילוט, פלומבה שלמה, מד הלחץ בטווח הירוק, מדבקת תוקף לא פגה.'),
  ('tsk_06', 6, '⚙️', 'מגיני מכונות ולחצני עצירה', 'כל המגנים במקומם ולא מנוטרלים, לחצני עצירת חירום נגישים ומסומנים. מגן שהוסר או נוטרל — דיווח דחוף מיד, לא ממתינים לסוף החודש.'),
  ('tsk_07', 7, '🩹', 'עזרה ראשונה וציוד מגן', 'עמדת עזרה ראשונה מלאה ובתוקף, מלאי ציוד מגן זמין בעמדה, והעובדים באזור משתמשים בפועל במה שנדרש.'),
  ('tsk_08', 8, '✅', 'מעקב סגירה', 'בודקים בשטח שהמפגעים שדיווחתם עליהם ונסגרו תוקנו באמת. מצלמים תמונת "אחרי" לכל מפגע שנסגר.')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.trustee_tasks';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';

-- Verify:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename='trustee_tasks';  -- 4 rows
--   SELECT n, t FROM public.trustee_tasks ORDER BY n;                          -- 8 rows, 1..8
-- Rollback (the app falls back to the built-in catalogue):
--   DROP TABLE public.trustee_tasks;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.trustee_tasks;
