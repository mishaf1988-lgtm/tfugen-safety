-- 2026-09-21 — דלי הגיבויים היה פתוח לכל סשן מאומת, כולל האנונימי
--
-- נמצא ב-`get_advisors` (הכלי ש-CLAUDE.md אמר שהוא מושבת — הוא עובד כשמעבירים
-- `project_id` במפורש), ואומת מול `pg_policies`.
--
-- ## מה היה
--
--   CREATE POLICY tapugan_auth_read_backups ON storage.objects
--     FOR SELECT TO authenticated
--     USING (bucket_id = 'backups');        -- ← וזהו. אין שום תנאי נוסף.
--
-- **זה בדיוק החור של #642, בדלי גרוע יותר.** #642 טיפל ב-`incidents-photos`
-- בלבד ולא נגע בדלי הזה.
--
-- מ-`2026-05-06` רץ cron לילי (03:00) שמעלה לכאן dump מלא של מסד הנתונים —
-- כרגע 53KB ליום, שלושה קבצים. ה-dump כולל את `app_users`: 12 אנשים אמיתיים
-- עם שם מלא, אימייל, טלפון ותפקיד. וכשהמפעל יתחיל לעבוד הוא יכלול גם את
-- ה-NCR, התאונות, בדיקות השמיעה והמעקב הרפואי.
--
-- מאז שמסך הנאמנים נכנס עם כניסה אנונימית, «authenticated» כולל כל מי
-- שפותח את הקיוסק. כלומר כל אחד כזה יכול היה להוריד את הגיבוי המלא.
--
-- ## מה זה עושה
--
-- מחליף את ה-policy באותה תבנית של #642, ומוסיף גם `is_admin_manager()`:
-- גיבוי מכיל **הכל**, ולכן מי שרשאי לקרוא אותו הוא מי שרשאי לראות הכל ממילא.
--
-- לא שובר כלום: הקורא היחיד באפליקציה הוא `_backupSyncFromStorage`
-- (index.html), שדורש חיבור OneDrive פעיל — דבר שרק מיכאל מגדיר. ה-cron
-- עצמו כותב עם ה-service key, שעוקף RLS ואינו מושפע.
--
-- fail-closed: טוקן בלי claim של `is_anonymous` נחשב אנונימי.

DROP POLICY IF EXISTS tapugan_auth_read_backups ON storage.objects;

CREATE POLICY tapugan_auth_read_backups ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'backups'
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    AND coalesce(auth.jwt() ->> 'email', '') <> ''
    AND private.is_admin_manager()
  );

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- אימות — להדביק אחרי ההרצה
-- ============================================================
-- 1) ה-policy קיימת ומוגבלת (שורה אחת, עם is_anonymous ועם is_admin_manager):
-- SELECT policyname, cmd, qual FROM pg_policies
-- WHERE schemaname='storage' AND tablename='objects' AND policyname='tapugan_auth_read_backups';
--
-- 2) ואין policy אחרת שנותנת גישה לדלי הזה — צריך להחזיר 1:
-- SELECT count(*) FROM pg_policies
-- WHERE schemaname='storage' AND tablename='objects'
--   AND (qual LIKE '%backups%' OR with_check LIKE '%backups%');
--
-- ============================================================
-- רולבק — מחזיר את החור. לא להריץ אלא אם משהו באמת נשבר.
-- ============================================================
-- DROP POLICY IF EXISTS tapugan_auth_read_backups ON storage.objects;
-- CREATE POLICY tapugan_auth_read_backups ON storage.objects
--   FOR SELECT TO authenticated USING (bucket_id = 'backups');
-- NOTIFY pgrst, 'reload schema';
