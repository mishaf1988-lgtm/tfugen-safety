-- כמעט ונפגע → התראה מיידית (2026-09-21)
--
-- מיכאל, 21/09: «אני צריך ככה שהם ממלאים מפגע בסיור הוא עולה מייד וגם כמעט
-- ונפגע, שלא יצא מצב שכמה אנשים מעלים ומגלים מאוחר».
--
-- החצי הראשון כבר עובד מ-2026-09-19: `trustee_reports` עם `ok=false` מפעיל
-- טריגר שקורא ל-`/api/trustee-notify`, והוא שולח WhatsApp ומייל לממונה.
-- `near_miss` נשאר בחוץ — וזו דווקא הטבלה שכל אחד יכול לכתוב אליה, לא רק
-- נאמן. עד היום דיווח כזה לא הגיע לאף אחד עד שהממונה פתח את האפליקציה.
--
--   INSERT near_miss
--     → AFTER INSERT trigger → pg_net POST /api/trustee-notify {"id":…,"src":"near_miss"}
--       → הפונקציה קוראת את השורה עם מפתח השרת, תופסת `notified_at` פעם אחת,
--         ושולחת לנמען ששמור ב-notification_prefs תחת `trustee_hazard`.
--
-- **אותו נמען בכוונה.** מספר טלפון אחד וכתובת אחת למלא, לא שניים.
--
-- אין תנאי על הסטטוס: כל שורת `near_miss` חדשה היא אירוע שצריך לדעת עליו.
-- עדכון של שורה קיימת אינו מפעיל כלום (AFTER INSERT בלבד), כדי שעריכה של
-- דיווח ישן לא תוציא התראה שנייה.
--
-- Idempotent: IF NOT EXISTS / OR REPLACE / DROP TRIGGER IF EXISTS.
-- בטוח להרצה חוזרת, אבל ראה כלל 7 ב-CLAUDE.md: זה לא מוכיח שהוא רץ.

CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.near_miss ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE OR REPLACE FUNCTION private.near_miss_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://tapugan-safety.pages.dev/api/trustee-notify',
      body := jsonb_build_object('id', NEW.id, 'src', 'near_miss'),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 8000
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;   -- תקלה ב-webhook לעולם לא תחסום שמירה של דיווח
  END;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION private.near_miss_notify() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS near_miss_notify ON public.near_miss;
CREATE TRIGGER near_miss_notify
  AFTER INSERT ON public.near_miss
  FOR EACH ROW EXECUTE FUNCTION private.near_miss_notify();

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- אימות — להדביק אחרי ההרצה
-- ============================================================
-- 1) העמודה והטריגר קיימים (צריך להחזיר שורה אחת בכל שאילתה):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='near_miss' AND column_name='notified_at';
--
-- SELECT tgname FROM pg_trigger
-- WHERE tgrelid='public.near_miss'::regclass AND NOT tgisinternal AND tgname='near_miss_notify';
--
-- 2) מקצה לקצה — להכניס שורת בדיקה, לחכות כמה שניות, ולראות 200:
-- INSERT INTO public.near_miss (id, d, descr, area, rep, sev, s, ts)
-- VALUES ('nmtest1', current_date, 'בדיקת התראה — למחוק', 'בדיקה', 'בדיקה', 'נמוכה', 'פתוח', now());
--
-- SELECT id, status_code, left(content, 160) FROM net._http_response ORDER BY id DESC LIMIT 3;
--   צפוי: 200. אם עדיין לא מילאת נמען בהגדרות ההתראות, התוכן יהיה
--   {"ok":true,"skipped":"no recipient configured"} — זה אומר שהצנרת עובדת.
--
-- DELETE FROM public.near_miss WHERE id='nmtest1';
--
-- ============================================================
-- רולבק
-- ============================================================
-- DROP TRIGGER IF EXISTS near_miss_notify ON public.near_miss;
-- DROP FUNCTION IF EXISTS private.near_miss_notify();
-- העמודה notified_at נשארת. מחיקתה היא ALTER ... DROP COLUMN, פעולה הרסנית
-- לפי CLAUDE.md, והיא לא מפריעה לכלום.
