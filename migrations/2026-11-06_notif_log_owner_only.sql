-- 06/11/2026: יומן ההודעות (notifications_log) נפתח רק למיכאל ולשרת.
-- מיכאל בשאלון 06/11/2026, על רטרו 19/10 (ד): "בצע: רק אני רואה (מומלץ)".
-- היומן מחזיק את הטקסט המלא של השיחות בוואטסאפ ובצ'אט עם העוזר (owner_in, assistant, wa_out).
-- עד היום כל מנהל (policy notifications_log_admin_manager_all) וכל צופה (viewer_read) קראו אותו.
-- מיכאל = admin@tfugen.local (DECISIONS: "מייל admin של Supabase Auth, אסור לשנות"). השרת עובד עם service role
-- ולא עובר ב-RLS, ולכן wa-hook, chat.js, routine-db, wa-morning, trustee-notify והגיבוי לא מושפעים.
-- בדפדפן של מנהל אחר: _notifLog ב-index.html כבר לא שולח שורה לשרת (ההתראה נשארת מקומית),
-- כדי שה-insert עם return=representation לא ייכשל ויישאר תקוע בתור.
--
-- איך: policy RESTRICTIVE חדשה, בלי DROP. RESTRICTIVE נבדקת בנוסף לכל ה-PERMISSIVE, ולכן גם מנהל
-- (notifications_log_admin_manager_all) וגם צופה (viewer_read) מקבלים 0 שורות ולא יכולים לכתוב.
-- ניסיון ראשון עם DROP POLICY ב-apply_migration נתקע 230 שניות על שאלת אישור של ה-connector ולא נכנס
-- (נבדק ב-pg_policies), כמו שכתוב ב-tfugen-db.
--
-- ה-policies הקיימות (גיבוי, pg_policies 06/11/2026), נשארות כמו שהן:
--   notifications_log_admin_manager_all  PERMISSIVE ALL    using/check ((select private.is_admin_manager()))
--   viewer_read                          PERMISSIVE SELECT using ((select private.is_viewer()))
--   mfa_required, pwchange_required      RESTRICTIVE ALL
--   viewer_no_insert/update/delete       RESTRICTIVE
-- להחזרה (רק במילה של מיכאל): drop policy notifications_log_owner_only on public.notifications_log
-- נתונים: לא משתנים (2,279 שורות, כולן user_email = server, 06/11/2026).

create policy notifications_log_owner_only on public.notifications_log as restrictive for all to authenticated
  using (((select auth.jwt()) ->> 'email') = 'admin@tfugen.local')
  with check (((select auth.jwt()) ->> 'email') = 'admin@tfugen.local');
