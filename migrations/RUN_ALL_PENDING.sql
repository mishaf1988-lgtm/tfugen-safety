-- ======================================================================
-- כל המיגרציות הממתינות — 2026-09-20
-- ======================================================================
--
-- הדבק את הקובץ הזה כולו ב-Supabase → SQL Editor → + New query → Run.
-- זה מחליף את שבע ההרצות הנפרדות. בטוח לחזור עליו: הכל
-- IF NOT EXISTS / DO $$ guards.
--
-- הקובץ הזה נוצר אוטומטית מהקבצים הבודדים (tools/build-run-all.mjs).
-- אל תערוך אותו ידנית — ערוך את הקובץ המקורי והרץ את הבונה מחדש.
--
-- מה יש כאן, לפי הסדר:
--   1. 🔴 #642  2026-09-20_storage_trustee_scope.sql
--        סוגר את חור ה-Storage — סשן אנונימי יכול לקרוא ולמחוק כל קובץ בדלי
--   2. 🔴 #643  2026-09-20_trustee_close_ownership.sql
--        נאמן יכול לסגור רק ממצא שהוא עצמו דיווח
--   3. 🟠 #658  2026-09-20_audit_log_append_only.sql
--        יומן הביקורת נהיה לקריאה והוספה בלבד — מנהל לא יכול למחוק את השורה שמתעדת אותו
--   4. 🟠 #655  2026-09-20_register_attachments.sql
--        קובץ מצורף למסמכים / ציוד מגן / קבלנים
--   5. 🟠 #679  2026-09-20_capa_result_and_cause.sql
--        תוצאת אימות אפקטיביות, קריטריון הצלחה, קטגוריית סיבת שורש
--   6. 🟠 #682  2026-09-20_hearing_expiry_and_leg_compliance.sql
--        תוקף לבדיקות שמיעה, ורשומת ציות מתוארכת
--   7. 🟠 #685  2026-09-20_history_review_verify.sql
--        היסטוריית חידושים, תיק סקירות הנהלה, אישור סגירה
--
-- הסדר מכוון: חור ה-Storage ראשון, כי הוא היחיד שהוא דליפה חיה
-- ולא תכונה חסרה. כל השאר בלתי תלויות זו בזו.
--
-- ⚠ שים לב: הקטע הראשון (#642) והשלישי (#658) מחליף policies קיימות
--   — DROP POLICY IF EXISTS ומיד CREATE POLICY במקום. זו המטרה שלהן:
--   ה-policies הישנות הן החור. אין בהן מחיקת נתונים.
--
-- ⚠ בלוקי האימות והרולבק של כל מיגרציה נשארו מוערים, כמו בקבצים
--   המקוריים. אף טבלה ואף עמודה לא נמחקת.
-- ======================================================================


-- ======================================================================
-- 1/7 · 🔴 · Issue #642 · 2026-09-20_storage_trustee_scope.sql
-- ======================================================================

-- Storage — the anonymous kiosk session had the run of the whole bucket
-- Date: 2026-09-20 (security review, second round)
--
-- ⚠ NOT YET RUN. Needs Michael's explicit go-ahead: this replaces four existing
--   RLS policies, which CLAUDE.md classes as a destructive-class operation
--   approved each time.
--
-- THE HOLE
-- April's two Storage migrations made 'incidents-photos' private and then gave
-- every signed-in user the whole bucket:
--
--   incidents_photos_select_authenticated   SELECT TO authenticated  bucket_id = …
--   incidents_photos_insert_authenticated   INSERT TO authenticated  bucket_id = …
--   incidents_photos_update_authenticated   UPDATE TO authenticated  bucket_id = …
--   incidents_photos_delete_authenticated   DELETE TO authenticated  bucket_id = …
--
-- In April "authenticated" meant a real account. In September the app gained a
-- no-password trustee screen that signs in ANONYMOUSLY, and a Supabase
-- anonymous sign-in produces a token whose role is exactly `authenticated`.
-- That is the same trap #615 closed on the API side on 2026-09-20 — this is
-- the side of it nobody checked.
--
-- So today, any visitor to the public site can, with two taps and a console:
--   * LIST and DOWNLOAD every file ever uploaded — incident photos, hearing-test
--     scans, medical documents, contractor files. (Creating a signed URL is a
--     SELECT, so index.html's own _sign() is all the tooling needed.)
--   * OVERWRITE any of them: _fileUpload sends `x-upsert: true`, and listing
--     hands over the exact object names, so nothing has to be guessed.
--   * DELETE any of them.
--
-- WHAT THE KIOSK ACTUALLY NEEDS — read from the code, not assumed:
--   * upload a tour photo, and the "after" photo that closes a finding
--   * display its own photos: _truRender (index.html ~14331) renders a 📷 link,
--     and _sign() (~16387) mints it by POSTing to /storage/v1/object/sign/…,
--     which RLS treats as a SELECT. Without SELECT the link goes dead.
--   * nothing else. The app issues no DELETE to Storage anywhere — grep for
--     method:'DELETE' against /storage/v1/object returns zero hits, and
--     _attachClear only drops the local reference.
--
-- THE BOUNDARY
-- _attachBtn / _attachClear call _attachPick(areaId, areaId) — the upload
-- PREFIX IS THE AREA ID — and the trustee form's area ids come from
-- _truPhId(n,k) = 'tru-ph-<task>-<item>'. _fileUpload names the object
-- `<prefix>-<Date.now()>.jpg`, so every trustee tour photo, and only a trustee
-- tour photo, is stored under a name beginning 'tru-ph-'. Every other upload
-- path uses a different prefix (nm, inc, tr, toolbox, easp, round, eqi, docs,
-- pf-<page>, cap-, cap-vid-). Note 'tr-' (training certificates) does not
-- collide: 'tru-ph-…' does not begin with 'tr-'.
-- tests/harness/storage-scope-test.js holds that boundary in place.
--
-- WHO COUNTS AS A REAL USER
-- The same test functions/_shared.js requireUser() applies: not flagged
-- anonymous, AND carrying an email — every real account in this app signs in
-- with one, so its absence is the tell. Both checks FAIL CLOSED: a token with
-- no is_anonymous claim at all is treated as anonymous.

-- ---------------------------------------------------------------------------
-- SELECT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "incidents_photos_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_select_named_user"    ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_select_trustee_kiosk" ON storage.objects;

-- A real, named account reads the whole bucket, exactly as before.
CREATE POLICY "incidents_photos_select_named_user"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'incidents-photos'
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    AND coalesce(auth.jwt() ->> 'email', '') <> ''
  );

-- Anyone signed in — including the anonymous kiosk — reads tour photos, which
-- is all the trustee screen ever renders.
CREATE POLICY "incidents_photos_select_trustee_kiosk"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'incidents-photos'
    AND name LIKE 'tru-ph-%'
  );

-- ---------------------------------------------------------------------------
-- INSERT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "incidents_photos_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_insert_named_user"    ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_insert_trustee_kiosk" ON storage.objects;

CREATE POLICY "incidents_photos_insert_named_user"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'incidents-photos'
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    AND coalesce(auth.jwt() ->> 'email', '') <> ''
  );

-- The tour photo. This is the one thing the kiosk must keep.
CREATE POLICY "incidents_photos_insert_trustee_kiosk"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'incidents-photos'
    AND name LIKE 'tru-ph-%'
  );

-- ---------------------------------------------------------------------------
-- UPDATE — _fileUpload always sends x-upsert, so an upload onto an existing
-- name is an UPDATE. Names carry Date.now(), so a real collision is vanishing,
-- but the kiosk must not be able to overwrite anything outside its own prefix.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "incidents_photos_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_update_named_user"    ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_update_trustee_kiosk" ON storage.objects;

CREATE POLICY "incidents_photos_update_named_user"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'incidents-photos'
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    AND coalesce(auth.jwt() ->> 'email', '') <> ''
  )
  WITH CHECK (
    bucket_id = 'incidents-photos'
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    AND coalesce(auth.jwt() ->> 'email', '') <> ''
  );

CREATE POLICY "incidents_photos_update_trustee_kiosk"
  ON storage.objects FOR UPDATE TO authenticated
  USING      (bucket_id = 'incidents-photos' AND name LIKE 'tru-ph-%')
  WITH CHECK (bucket_id = 'incidents-photos' AND name LIKE 'tru-ph-%');

-- ---------------------------------------------------------------------------
-- DELETE — named users only. The app never deletes from Storage at all, so
-- this takes nothing away from anyone; it removes the ability entirely from
-- the one session type that should never have had it.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "incidents_photos_delete_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_delete_named_user"    ON storage.objects;

CREATE POLICY "incidents_photos_delete_named_user"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'incidents-photos'
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    AND coalesce(auth.jwt() ->> 'email', '') <> ''
  );

-- Idempotent: every statement drops before it creates. Re-running is safe.

-- VERIFY after running (paste into the SQL editor):
--
--   -- 1. seven policies, and none of the old bucket-wide four
--   SELECT policyname, cmd
--     FROM pg_policies
--    WHERE schemaname = 'storage' AND tablename = 'objects'
--      AND policyname LIKE 'incidents_photos%'
--    ORDER BY cmd, policyname;
--   -- expect exactly:
--   --   DELETE  incidents_photos_delete_named_user
--   --   INSERT  incidents_photos_insert_named_user
--   --   INSERT  incidents_photos_insert_trustee_kiosk
--   --   SELECT  incidents_photos_select_named_user
--   --   SELECT  incidents_photos_select_trustee_kiosk
--   --   UPDATE  incidents_photos_update_named_user
--   --   UPDATE  incidents_photos_update_trustee_kiosk
--   -- and NO policyname ending in _authenticated
--
--   -- 2. how many objects the kiosk can still see, and of what kind
--   SELECT split_part(name, '-', 1) AS prefix, count(*)
--     FROM storage.objects
--    WHERE bucket_id = 'incidents-photos'
--    GROUP BY 1 ORDER BY 2 DESC;
--   -- the kiosk now sees only the 'tru' rows; everything else is closed to it
--
-- THEN, ON THE PHONE (this is the part that matters):
--   1. open the trustee link, file a tour with a photo → it must upload
--   2. reopen the trustee screen → the 📷 link on that report must still open
--   3. close a finding with an "after" photo → must upload
--   4. sign in as the manager → every photo, everywhere, must still open
--
-- Rollback: re-run 2026-04-21_storage_private.sql and
-- 2026-04-21_storage_rls_writes.sql, which hold the original four policies.


-- ======================================================================
-- 2/7 · 🔴 · Issue #643 · 2026-09-20_trustee_close_ownership.sql
-- ======================================================================

-- Trustee closure trigger — ownership check (2026-09-20, security review)
--
-- ⚠ NOT YET RUN. Needs Michael's explicit go-ahead (CLAUDE.md: changing an
--   existing DB function is a destructive-class operation, approved each time).
--
-- THE HOLE
-- private.trustee_reports_close_ref() from 2026-09-18 is SECURITY DEFINER and
-- closes whatever row NEW.ref names, with no check that the person filing the
-- closure is the one who reported the finding:
--
--     UPDATE public.trustee_reports SET s = 'נסגר'
--      WHERE id = NEW.ref AND ok = false AND t BETWEEN 1 AND 7 AND s <> 'נסגר';
--
-- Combined with the two policies the same migration created —
--     emp_select  USING (true)        -- any session reads every finding + its id
--     emp_insert  WITH CHECK (true)   -- any session inserts
-- — and with the no-password trustee screen handing every visitor an anonymous
-- Supabase session, ANY visitor to the public site can:
--   1. list every open hazard and its id, then
--   2. insert {t:8, ref:<id>, ok:true} rows in a loop
-- and silently mark the whole open-findings list 'נסגר'. That empties the
-- manager's findings view and the #591 "reported, routed, still not fixed"
-- alert. The same primitive files reports under any trustee's name (u is free
-- text), which corrupts the scoreboard and the monthly prize.
--
-- THE FIX
-- A closure may only close a finding filed under the SAME trustee name. That is
-- the strongest check available here: an anonymous session carries no identity
-- of its own, so u is all there is. It does not stop a determined person who
-- knows a trustee's name from closing that trustee's own findings — it does
-- stop the enumerate-everything sweep, which is the actual risk.
--
-- Nothing legitimate changes: _truCloseReport (index.html) always files the
-- closure under the same name shown on the trustee's screen, and the manager
-- closes findings through an UPDATE (admin/manager policy), not through this
-- trigger.
--
-- Idempotent: CREATE OR REPLACE. Re-running is safe.

CREATE OR REPLACE FUNCTION private.trustee_reports_close_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.t = 8 AND NEW.ref IS NOT NULL AND NEW.ref <> '' THEN
    UPDATE public.trustee_reports
       SET s = 'נסגר'
     WHERE id = NEW.ref
       AND ok = false
       AND t BETWEEN 1 AND 7
       AND s <> 'נסגר'
       -- added 2026-09-20: only the trustee who filed it may close it
       AND u IS NOT DISTINCT FROM NEW.u;
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION private.trustee_reports_close_ref() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- VERIFY after running (paste into the SQL editor):
--
--   -- 1. the new condition is in the function body
--   SELECT prosrc LIKE '%IS NOT DISTINCT FROM NEW.u%' AS has_ownership_check
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'private' AND p.proname = 'trustee_reports_close_ref';
--   -- expect: t
--
--   -- 2. a closure filed under a DIFFERENT name must not close anything.
--   --    Run inside a transaction and roll back so nothing is left behind.
--   BEGIN;
--     INSERT INTO public.trustee_reports (id,u,m,t,d,loc,ok,f,s)
--     VALUES ('ztest_find','בדיקה א','2026-09',5,'2026-09-20','בדיקה',false,'ממצא בדיקה','פתוח');
--     INSERT INTO public.trustee_reports (id,u,m,t,d,loc,ok,s,ref)
--     VALUES ('ztest_close','בדיקה ב','2026-09',8,'2026-09-20','בדיקה',true,'תקין','ztest_find');
--     SELECT s FROM public.trustee_reports WHERE id='ztest_find';   -- expect: פתוח
--     INSERT INTO public.trustee_reports (id,u,m,t,d,loc,ok,s,ref)
--     VALUES ('ztest_close2','בדיקה א','2026-09',8,'2026-09-20','בדיקה',true,'תקין','ztest_find');
--     SELECT s FROM public.trustee_reports WHERE id='ztest_find';   -- expect: נסגר
--   ROLLBACK;
--
-- Rollback of the change itself: re-run 2026-09-18_trustee_reports.sql, which
-- holds the original function body.


-- ======================================================================
-- 3/7 · 🟠 · Issue #658 · 2026-09-20_audit_log_append_only.sql
-- ======================================================================

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
-- גם החדש — אחרת הרצה שנייה של הקובץ נופלת על «policy already exists».
DROP POLICY IF EXISTS audit_log_admin_manager_select ON public.audit_log;

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


-- ======================================================================
-- 4/7 · 🟠 · Issue #655 · 2026-09-20_register_attachments.sql
-- ======================================================================

-- 2026-09-20 — קובץ מצורף לשלושה מרשמים: מסמכים, ציוד מגן, קבלנים
--
-- BACKLOG 3.8 + 3.9. מריצים ב-Supabase → SQL Editor. בטוח לחזור עליו.
--
-- ## למה
--
-- לשלושת המרשמים האלה יש תאריך תוקף, הם נסרקים בדף התפוגות, והם מייצרים
-- התראת «פג בעוד 30 יום» — ואי אפשר לצרף אליהם את המסמך שעליו הסטטוס מסתמך:
--
--   * `docs`  — נוהל ISO חתום, תעודת תקן, רישיון. הרשומה אומרת
--               «ISO 45001:2018 · בתוקף עד 12/2026» ואין לה קובץ. מבקר שמבקש
--               לראות את הנוהל מקבל שורה בטבלה.
--   * `ppe`   — תסקיר בדיקה תקופתית לרתמה / מתלה, שהתקן דורש.
--   * `ctr`   — אישור ביטוח, הסכם חתום, תעודת הדרכה. השדות «תוקף הסכם»
--               ו«הדרכות בטיחות: הוכשר» הם dropdown שמישהו בחר בו ידנית.
--
-- שים לב: `ppe` כבר מקבל `file_url` היום — «צילום חכם» כותב אותו
-- (index.html, `rec.file_url=uploadedUrl` בענף `ppe`). בלי העמודה הזאת
-- PostgREST מחזיר PGRST204, הלקוח מוחק את השדה ושולח שוב, והרשומה נשמרת
-- **בלי** הקישור. כלומר תמונות של ציוד מגן שנסרקו עד היום כבר אבדו בדרך.
-- מ-PR #654 המחיקה הזאת מציגה אזהרה במקום לקרות בשקט.
--
-- ## מה זה עושה
--
-- מוסיף עמודת `file_url text` לשלוש הטבלאות. אין שינוי RLS, אין מחיקה,
-- אין נגיעה בשורות קיימות — העמודה נוצרת NULL לכולן.

ALTER TABLE public.docs ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.ppe  ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.ctr  ADD COLUMN IF NOT EXISTS file_url text;

-- PostgREST מחזיק cache של הסכמה. בלי זה הוא ימשיך להחזיר PGRST204
-- עד ה-reload הבא.
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- אימות — להדביק אחרי ההרצה. צריך להחזיר שלוש שורות.
-- ============================================================
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema='public'
--   AND table_name IN ('docs','ppe','ctr')
--   AND column_name='file_url'
-- ORDER BY table_name;
--
-- ובדיקה שהכתיבה עוברת (בתוך טרנזקציה שנסגרת ב-ROLLBACK, לא משנה כלום):
-- BEGIN;
--   UPDATE public.docs SET file_url='https://example.test/x.pdf'
--   WHERE id=(SELECT id FROM public.docs LIMIT 1)
--   RETURNING id, file_url;
-- ROLLBACK;

-- ============================================================
-- אחרי ההרצה — בדיקה בטלפון לפני שמסמנים ✅ ב-STATUS.md
-- ============================================================
--  [ ] מסמכים → + מסמך חדש → לצרף PDF → שמור → 👁 → הקובץ נפתח
--  [ ] מסמכים → 👁 → ✎ → לשנות תאריך תוקף → שמור →
--      נוצרה **עדכון** ולא רשומה שנייה, והקובץ עדיין שם
--  [ ] ציוד מגן → ✎ על פריט קיים → לצרף תסקיר → שמור → 👁 → נפתח
--  [ ] קבלנים → ✎ → לצרף אישור ביטוח → שמור → 👁 → נפתח
--  [ ] «צילום חכם» של תעודת ציוד מגן → 👁 → התמונה שם
--      (עד עכשיו היא נזרקה)
--
-- רולבק: ALTER TABLE public.docs DROP COLUMN file_url;  (וכן ל-ppe / ctr)
-- ⚠ זו פעולה הרסנית — מוחקת את הקישורים שכבר נשמרו.


-- ======================================================================
-- 5/7 · 🟠 · Issue #679 · 2026-09-20_capa_result_and_cause.sql
-- ======================================================================

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


-- ======================================================================
-- 6/7 · 🟠 · Issue #682 · 2026-09-20_hearing_expiry_and_leg_compliance.sql
-- ======================================================================

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


-- ======================================================================
-- 7/7 · 🟠 · Issue #685 · 2026-09-20_history_review_verify.sql
-- ======================================================================

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


-- ======================================================================
-- סיימת. עכשיו:
--   1. להריץ את בלוקי האימות שבתוך כל קטע למעלה (הם מוערים — להסיר -- ולהריץ)
--   2. לכתוב ב-Issues #642 #643 #658 #655 #679 #682 #685 שזה רץ ועבר
--      → ואז אפשר לסמן ב-BACKLOG.md את 1.7 1.11 3.3 3.5 3.7 4.5 5.8 5.10 5.11 6.11
-- ======================================================================
