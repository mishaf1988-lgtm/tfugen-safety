-- 2026-09-20 — היסטוריית חידושים, תיק סקירות הנהלה, ואישור סגירה של נאמן
--
-- BACKLOG 3.3 + 6.11 + 4.5. מריצים ב-Supabase → SQL Editor. בטוח לחזור עליו.
-- אין DROP, אין DELETE, אין שינוי של policy קיימת.
--
-- ============================================================
-- 3.3 — חידוש דורס את מה שהיה, ואין לזה היסטוריה
-- ============================================================
--
-- `_svPut` עושה `arr[k]=Object.assign({},arr[k],r); sbUpd(tbl,arr[k]);` —
-- כלומר מיכאל מחדש תעודת הדרכה או תוקף צמ"ג: פותח ✎, משנה את התאריך,
-- שומר — ו**תאריך התפוגה הקודם נעלם**. מול מבקר אפשר להראות ב-`audit_log`
-- ש«מישהו עדכן את TR-17 ב-3/9», אבל לא **מה היה** התוקף לפני כן ולא מתי
-- בוצעה ההדרכה הקודמת.
--
-- לציוד יש כבר מסלול חידוש עם היסטוריה (`equip_inspection_history`), אבל
-- הוא נקרא **רק** ממסלול ה-PDF — אף פעם לא מ-`svEqi`.
--
-- **למה טבלה אחת ולא שכפול של `equip_inspection_history` לכל טבלה:**
-- `DECISIONS.md` (ncr_ai) דוחה במפורש עמודת jsonb יחידה כי «אין היסטוריה,
-- קשה ל-query». טבלה גנרית אחת עם `table_name` + `record_id` שומרת על
-- יכולת ה-query ולא מוסיפה 15 טבלאות.

CREATE TABLE IF NOT EXISTS public.record_history (
  id           text        PRIMARY KEY,
  table_name   text        NOT NULL,
  record_id    text        NOT NULL,
  e_old        date,                    -- התפוגה שהייתה לפני החידוש
  e_new        date,                    -- ומה שהיא הפכה להיות
  d_old        date,                    -- תאריך הביצוע הקודם (הדרכה/בדיקה)
  note         text,
  changed_by   text,
  ts           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS record_history_entity_idx ON public.record_history(table_name, record_id, ts DESC);

ALTER TABLE public.record_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'record_history_read') THEN
    CREATE POLICY record_history_read ON public.record_history
      FOR SELECT TO authenticated
      USING (private.is_admin_manager());
  END IF;
  -- כתיבה בלבד, בלי UPDATE ובלי DELETE: היסטוריית חידושים שאפשר לערוך
  -- אינה היסטוריה. אותו שיקול כמו ב-audit_log (BACKLOG 5.8).
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'record_history_insert') THEN
    CREATE POLICY record_history_insert ON public.record_history
      FOR INSERT TO authenticated
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;

-- ============================================================
-- 6.11 — נרטיב סקירת ההנהלה נכתב, מוצג, ונעלם
-- ============================================================
--
-- `_mrAINarrative` בונה את הנרטיב המלא לפי §9.3 ואז עושה בדיוק דבר אחד
-- איתו: `window._mrAIRaw=content;` — משתנה JS שחי עד רענון הדף. שני
-- הכפתורים לידו הם «צור מחדש» ו«העתק». אותו דבר ב-`_annualISOReport`.
--
-- כלומר סקירת ההנהלה — שהתקן דורש **תיעוד** שלה (§9.3.3: "documented
-- information as evidence of the results of management reviews") — קיימת
-- רק בלוח של מי שלחץ העתק. אין טבלה כזו באף אחת מ-80 המיגרציות.

CREATE TABLE IF NOT EXISTS public.mgmt_reviews (
  id          text        PRIMARY KEY,
  kind        text        NOT NULL,     -- 'review' (סקירה תקופתית) / 'annual' (דוח שנתי)
  period      text,                     -- למשל "Q3 2026" או "2026"
  content     text        NOT NULL,
  kpis        text,                     -- ה-KPIs שהוזנו לנרטיב, כ-JSON
  created_by  text,
  ts          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mgmt_reviews_ts_idx ON public.mgmt_reviews(ts DESC);

ALTER TABLE public.mgmt_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'mgmt_reviews_admin_manager_all') THEN
    CREATE POLICY mgmt_reviews_admin_manager_all ON public.mgmt_reviews
      FOR ALL TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;

-- ============================================================
-- 4.5 — סגירת ליקוי נאמן אינה נבדקת על ידי אף אחד
-- ============================================================
--
-- שים לב: **שהנאמן סוגר בעצמו זו החלטה מפורשת שלך** — `DECISIONS.md`
-- 2026-09-18 §3, במכוון בלי UPDATE ובלי RPC כדי שזה יעבוד אופליין דרך
-- ה-outbox. זה **לא** משתנה כאן, והניקוד לא משתנה.
--
-- מה שנוסף הוא שכבה שנייה: אחרי שהנאמן סגר, המנהל יכול **לאשר** שהסגירה
-- נבדקה. בסכמה של `trustee_reports` אין שום שדה אישור (id, u, m, t, d,
-- location_id, loc, ok, f, photo_url, s, ref, mgr_note, ts), ולכן «נסגר»
-- על המסך אומר «הנאמן צילם תיקון», לא «מישהו בדק».

ALTER TABLE public.trustee_reports ADD COLUMN IF NOT EXISTS verified_by text;
ALTER TABLE public.trustee_reports ADD COLUMN IF NOT EXISTS verified_at timestamptz;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- אימות — להדביק אחרי ההרצה
-- ============================================================
-- 1) שתי הטבלאות החדשות קיימות (2 שורות):
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema='public' AND table_name IN ('record_history','mgmt_reviews')
-- ORDER BY table_name;
--
-- 2) שתי העמודות על trustee_reports (2 שורות):
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='trustee_reports'
--   AND column_name IN ('verified_by','verified_at') ORDER BY column_name;
--
-- 3) ה-policies (3 שורות: record_history_read, record_history_insert,
--    mgmt_reviews_admin_manager_all):
-- SELECT polname, polcmd FROM pg_policy
-- WHERE polrelid IN ('public.record_history'::regclass,'public.mgmt_reviews'::regclass)
-- ORDER BY polname;
--
-- 4) record_history אינו ניתן לעריכה או למחיקה — צריך להחזיר 0 שורות:
-- SELECT polname FROM pg_policy
-- WHERE polrelid='public.record_history'::regclass AND polcmd IN ('w','d');
--
-- 5) ושום שורה קיימת לא נפגעה:
-- SELECT count(*) AS trustee_rows FROM public.trustee_reports;
--
-- ============================================================
-- רולבק
-- ============================================================
-- DROP TABLE הוא פעולה הרסנית לפי CLAUDE.md ודורש אישור מפורש.
-- שתי הטבלאות חדשות, אז מחיקתן לא נוגעת בנתונים קיימים — אבל היא כן
-- מוחקת כל סקירת הנהלה וכל שורת היסטוריה שנשמרו מאז ההרצה.
--
-- DROP TABLE IF EXISTS public.record_history;
-- DROP TABLE IF EXISTS public.mgmt_reviews;
-- ALTER TABLE public.trustee_reports DROP COLUMN IF EXISTS verified_by;
-- ALTER TABLE public.trustee_reports DROP COLUMN IF EXISTS verified_at;
-- NOTIFY pgrst, 'reload schema';
